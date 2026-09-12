import os
import tempfile
import unittest
from unittest.mock import patch

from pydantic import ValidationError

TEST_DB = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
TEST_DB.close()
os.environ['POCKET_TUTOR_DB_PATH'] = TEST_DB.name

import main


class BinditBackendTests(unittest.TestCase):
    def setUp(self):
        main.database.reset_db()

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(TEST_DB.name):
            os.unlink(TEST_DB.name)

    def save_math_question(self, student_id='student-1'):
        return main.database.save_question(
            student_id,
            'What is 2 + 2?',
            '4',
            'addition',
            1,
        )

    def test_yes_no_and_filename_answers(self):
        self.assertTrue(main.answers_match('Yes', 'yes'))
        self.assertTrue(main.answers_match('Y', 'true'))
        self.assertTrue(main.answers_match('mendel', 'mendel.pdf'))

    def test_mistake_classification(self):
        self.assertEqual(main.classify_mistake('5', '4'), 'off_by_one')
        self.assertEqual(main.classify_mistake('-4', '4'), 'sign_error')
        self.assertEqual(main.classify_mistake('40', '4'), 'place_value_error')
        self.assertEqual(main.classify_mistake('', '4'), 'blank_answer')

    def test_question_generation(self):
        for topic in ('addition', 'subtraction', 'multiplication', 'division', 'mixed'):
            question = main.generate_math_question(topic, 2)
            self.assertTrue(question.question)
            self.assertTrue(question.correct_answer)
            self.assertIn(question.topic, ('addition', 'subtraction', 'multiplication', 'division'))

    def test_notes_question_generation(self):
        question = main.generate_notes_question(
            main.NoteContext(
                course='Biology',
                unit='Heredity',
                files=['mendel.pdf', 'dna.txt'],
                other_units=['Cell structure'],
                other_courses=['Chemistry'],
            ),
            2,
        )
        self.assertTrue(question.question)
        self.assertTrue(question.correct_answer)
        self.assertEqual(question.topic, 'notes')

    def test_public_question_hides_answer_and_stores_it_server_side(self):
        with patch.object(main.auth, 'authenticated_user', return_value={'id': 'student-1'}):
            response = main.generate_question(main.QuestionRequest(topic='addition', difficulty=1), 'Bearer test')
        self.assertTrue(response.question_id)
        self.assertFalse(hasattr(response, 'correct_answer'))
        stored = main.database.get_question('student-1', response.question_id)
        self.assertIsNotNone(stored)
        self.assertTrue(stored['correct_answer'])

    def test_client_cannot_submit_its_own_correct_answer(self):
        with self.assertRaises(ValidationError):
            main.AnswerRequest(
                question_id='a' * 32,
                student_answer='999',
                correct_answer='999',
            )

    def test_answer_updates_authenticated_users_progress(self):
        question_id = self.save_math_question()
        request = main.AnswerRequest(question_id=question_id, student_answer='4')
        with patch.object(main.auth, 'authenticated_user', return_value={'id': 'student-1'}):
            result = main.analyze_answer(request, 'Bearer test')
        progress = main.database.get_progress('student-1')
        self.assertTrue(result.correct)
        self.assertEqual(result.xp_earned, 10)
        self.assertEqual(progress['total_xp'], 10)
        self.assertEqual(progress['correct_answers'], 1)

    def test_wrong_answer_can_be_retried(self):
        question_id = self.save_math_question()
        with patch.object(main.auth, 'authenticated_user', return_value={'id': 'student-1'}):
            wrong = main.analyze_answer(
                main.AnswerRequest(question_id=question_id, student_answer='5'),
                'Bearer test',
            )
            correct = main.analyze_answer(
                main.AnswerRequest(question_id=question_id, student_answer='4'),
                'Bearer test',
            )
        progress = main.database.get_progress('student-1')
        self.assertFalse(wrong.correct)
        self.assertTrue(correct.correct)
        self.assertEqual(progress['attempts'], 2)
        self.assertEqual(progress['correct_answers'], 1)
        self.assertEqual(progress['total_xp'], 10)

    def test_completed_question_cannot_award_xp_twice(self):
        question_id = self.save_math_question()
        request = main.AnswerRequest(question_id=question_id, student_answer='4')
        with patch.object(main.auth, 'authenticated_user', return_value={'id': 'student-1'}):
            main.analyze_answer(request, 'Bearer test')
            with self.assertRaises(main.HTTPException) as context:
                main.analyze_answer(request, 'Bearer test')
        self.assertEqual(context.exception.status_code, 409)
        progress = main.database.get_progress('student-1')
        self.assertEqual(progress['total_xp'], 10)
        self.assertEqual(progress['attempts'], 1)

    def test_question_is_bound_to_authenticated_account(self):
        question_id = self.save_math_question('student-1')
        request = main.AnswerRequest(question_id=question_id, student_answer='4')
        with patch.object(main.auth, 'authenticated_user', return_value={'id': 'student-2'}):
            with self.assertRaises(main.HTTPException) as context:
                main.analyze_answer(request, 'Bearer test')
        self.assertEqual(context.exception.status_code, 404)
        self.assertIsNone(main.database.get_progress('student-2'))

    def test_progress_endpoint_uses_authenticated_identity(self):
        question_id = self.save_math_question()
        with patch.object(main.auth, 'authenticated_user', return_value={'id': 'student-1'}):
            main.analyze_answer(main.AnswerRequest(question_id=question_id, student_answer='4'), 'Bearer test')
            progress = main.get_my_progress('Bearer test')
        self.assertEqual(progress.student_id, 'student-1')
        self.assertEqual(progress.total_xp, 10)
        self.assertEqual(progress.accuracy, 100.0)

    def test_unknown_student_progress_returns_404(self):
        with patch.object(main.auth, 'authenticated_user', return_value={'id': 'missing'}):
            with self.assertRaises(main.HTTPException) as context:
                main.get_my_progress('Bearer test')
        self.assertEqual(context.exception.status_code, 404)


if __name__ == '__main__':
    unittest.main()
