import os
import tempfile
import unittest

TEST_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
TEST_DB.close()
os.environ["DATABASE_URL"] = ""
os.environ["POCKET_TUTOR_DB_PATH"] = TEST_DB.name

import main


class PocketTutorBackendTests(unittest.TestCase):
    def setUp(self):
        main.database.reset_db()

    @classmethod
    def tearDownClass(cls):
        main.database.engine().dispose()
        main.database.engine.cache_clear()
        if os.path.exists(TEST_DB.name):
            os.unlink(TEST_DB.name)

    def test_numeric_equivalence(self):
        self.assertTrue(main.answers_match("4.0", "4"))
        self.assertTrue(main.answers_match("1,000", "1000"))

    def test_database_url_normalizes_pasted_env_format(self):
        previous_url = os.environ.get("DATABASE_URL")
        try:
            os.environ["DATABASE_URL"] = ' DATABASE_URL="postgresql://user:password@db.example.com/app" '
            self.assertEqual(
                main.database.database_url(),
                "postgresql+psycopg://user:password@db.example.com/app",
            )
        finally:
            if previous_url is None:
                os.environ.pop("DATABASE_URL", None)
            else:
                os.environ["DATABASE_URL"] = previous_url

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

    def test_friend_request_and_leaderboard_flow(self):
        alice = main.create_profile(main.ProfileCreate(
            student_id="alice-id", username="alice", display_name="Alice",
        ))
        main.create_profile(main.ProfileCreate(
            student_id="bob-id", username="bob_the_builder", display_name="Bob",
        ))
        main.analyze_answer(main.AnswerRequest(
            question="What is 2 + 2?", student_answer="4", correct_answer="4",
            student_id="alice-id", topic="addition",
        ))

        request = main.create_friend_request(main.FriendRequestCreate(
            requester_id="bob-id", friend_code=alice["friend_code"],
        ))
        inbox = main.get_pending_friend_requests("alice-id")
        self.assertEqual(len(inbox), 1)
        self.assertEqual(inbox[0]["username"], "bob_the_builder")

        main.decide_friend_request(request["request_id"], main.FriendRequestDecision(
            recipient_id="alice-id", accept=True,
        ))
        leaderboard = main.get_friend_leaderboard("bob-id")
        self.assertEqual([entry["username"] for entry in leaderboard], ["alice", "bob_the_builder"])
        self.assertEqual(leaderboard[0]["total_xp"], 10)
        self.assertTrue(leaderboard[0]["active_today"])

    def test_cannot_add_self_or_duplicate_friendship(self):
        profile = main.create_profile(main.ProfileCreate(
            student_id="solo-id", username="solo_user", display_name="Solo",
        ))
        with self.assertRaises(main.HTTPException) as self_request:
            main.create_friend_request(main.FriendRequestCreate(
                requester_id="solo-id", friend_code=profile["friend_code"],
            ))
        self.assertEqual(self_request.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
