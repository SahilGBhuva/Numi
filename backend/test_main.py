import os
import tempfile
import unittest

TEST_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
TEST_DB.close()
os.environ["POCKET_TUTOR_DB_PATH"] = TEST_DB.name

import main


class PocketTutorBackendTests(unittest.TestCase):
    def setUp(self):
        main.database.reset_db()

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(TEST_DB.name):
            os.unlink(TEST_DB.name)

    def test_yes_no_and_filename_answers(self):
        self.assertTrue(main.answers_match("Yes", "yes"))
        self.assertTrue(main.answers_match("Y", "true"))
        self.assertTrue(main.answers_match("mendel", "mendel.pdf"))

    def test_mistake_classification(self):
        self.assertEqual(main.classify_mistake("5", "4"), "off_by_one")
        self.assertEqual(main.classify_mistake("-4", "4"), "sign_error")
        self.assertEqual(main.classify_mistake("40", "4"), "place_value_error")
        self.assertEqual(main.classify_mistake("", "4"), "blank_answer")

    def test_question_generation(self):
        for topic in ("addition", "subtraction", "multiplication", "division", "mixed"):
            question = main.generate_math_question(topic, 2)
            self.assertTrue(question.question)
            self.assertTrue(question.correct_answer)
            self.assertIn(question.topic, ("addition", "subtraction", "multiplication", "division"))

    def test_notes_question_generation(self):
        question = main.generate_notes_question(
            main.NoteContext(
                course="Biology",
                unit="Heredity",
                files=["mendel.pdf", "dna.txt"],
                other_units=["Cell structure"],
                other_courses=["Chemistry"],
            ),
            2,
        )
        self.assertTrue(question.question)
        self.assertTrue(question.correct_answer)
        self.assertEqual(question.topic, "notes")
        self.assertTrue(
            "Heredity" in question.question
            or "Biology" in question.question
            or "mendel.pdf" in question.question
            or "dna.txt" in question.question
        )

    def test_answer_updates_progress(self):
        request = main.AnswerRequest(
            question="What is 2 + 2?",
            student_answer="4",
            correct_answer="4",
            student_id="student-1",
            topic="addition",
        )
        result = main.analyze_answer(request)
        progress = main.get_progress("student-1")
        self.assertTrue(result.correct)
        self.assertEqual(result.xp_earned, 10)
        self.assertEqual(progress.total_xp, 10)
        self.assertEqual(progress.accuracy, 100.0)

    def test_multiple_correct_answers_count_as_one_streak_day(self):
        request = main.AnswerRequest(
            question="What is 2 + 2?",
            student_answer="4",
            correct_answer="4",
            student_id="daily-streak-student",
            topic="addition",
        )
        main.analyze_answer(request)
        main.analyze_answer(request)
        progress = main.get_progress("daily-streak-student")
        self.assertEqual(progress.streak, 1)
        self.assertEqual(progress.best_streak, 1)

    def test_wrong_answer_does_not_erase_daily_streak(self):
        correct_request = main.AnswerRequest(
            question="What is 2 + 2?",
            student_answer="4",
            correct_answer="4",
            student_id="streak-student",
            topic="addition",
        )
        wrong_request = correct_request.model_copy(update={"student_answer": "5"})
        main.analyze_answer(correct_request)
        main.analyze_answer(wrong_request)
        progress = main.get_progress("streak-student")
        self.assertEqual(progress.streak, 1)

    def test_unknown_student_returns_404(self):
        with self.assertRaises(main.HTTPException) as context:
            main.get_progress("missing")
        self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
