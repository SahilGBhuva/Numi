import os
import tempfile
import unittest
import unittest.mock

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

    def test_guest_progress_is_claimed_once_by_account(self):
        main.database.update_progress("guest-1", "addition", True, 10)
        main.database.update_progress("guest-1", "addition", False, 0)

        profile = main.database.onboard_account(
            "account-1", "bindit_learner", "Bindit Learner", "guest-1",
        )
        first_claim = main.database.get_progress("account-1")
        main.database.onboard_account(
            "account-1", "bindit_learner", "Bindit Learner", "guest-1",
        )
        second_claim = main.database.get_progress("account-1")

        self.assertEqual(profile["username"], "bindit_learner")
        self.assertTrue(profile["friend_code"])
        self.assertEqual(first_claim["total_xp"], 10)
        self.assertEqual(first_claim["attempts"], 2)
        self.assertEqual(first_claim, second_claim)

    def test_guest_progress_cannot_be_stolen_from_an_existing_account(self):
        main.database.onboard_account("real-account", "real_user", "Real")
        main.database.update_progress("real-account", "addition", True, 10)
        thief = main.database.onboard_account("thief-account", "thief_user", "Thief", "real-account")
        self.assertEqual(thief["total_xp"], 0)

    def test_account_profile_requires_a_token(self):
        with self.assertRaises(main.HTTPException) as missing:
            main.get_account_profile(None)
        self.assertEqual(missing.exception.status_code, 401)

    def test_analyze_answer_uses_verified_account_id(self):
        request = main.AnswerRequest(
            question="What is 2 + 2?",
            student_answer="4",
            correct_answer="4",
            student_id="spoofed-id",
            topic="addition",
        )
        with unittest.mock.patch.object(main.storage, "authenticated_user", return_value={"id": "acct-1", "email": "a@b.c"}):
            result = main.analyze_answer(request, authorization="Bearer fake")
        self.assertEqual(result.total_xp, 10)
        self.assertIsNone(main.database.get_progress("spoofed-id"))
        self.assertEqual(main.database.get_progress("acct-1")["total_xp"], 10)


if __name__ == "__main__":
    unittest.main()
