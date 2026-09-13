import os
import tempfile
import unittest
from unittest.mock import patch

TEST_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
TEST_DB.close()
os.environ["POCKET_TUTOR_DB_PATH"] = TEST_DB.name

import database
import main


class FriendsTests(unittest.TestCase):
    def setUp(self):
        database.reset_db()
        self.alex = database.onboard_account("alex-id", "alex", "Alex", None)
        self.sam = database.onboard_account("sam-id", "sam", "Sam", None)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(TEST_DB.name):
            os.unlink(TEST_DB.name)

    def become_friends(self):
        request = database.send_friend_request("alex-id", self.sam["friend_code"])
        database.respond_to_friend_request(request["request_id"], "sam-id", True)

    def test_friend_request_acceptance_and_leaderboard(self):
        self.become_friends()
        database.update_progress("alex-id", "Biology", True, 30)
        friends = database.list_friends("sam-id")
        self.assertEqual(friends[0]["student_id"], "alex-id")
        leaderboard = database.friend_leaderboard("sam-id")
        self.assertEqual(leaderboard[0]["student_id"], "alex-id")
        self.assertEqual(leaderboard[0]["total_xp"], 30)

    def test_friend_quest_tracks_combined_xp(self):
        self.become_friends()
        quest = database.create_friend_quest("alex-id", "sam-id", 100)
        self.assertEqual(quest["progress_xp"], 0)
        database.update_progress("sam-id", "History", True, 40)
        updated = database.active_friend_quests("alex-id")[0]
        self.assertEqual(updated["progress_xp"], 40)

    def test_friend_endpoints_use_authenticated_identity(self):
        with patch.object(main, "current_account", return_value={"id": "alex-id"}):
            result = main.create_friend_request(main.FriendRequestCreate(friend_code=self.sam["friend_code"]), "Bearer test")
        self.assertEqual(result["status"], "pending")
        self.assertEqual(database.pending_friend_requests("sam-id")[0]["username"], "alex")

    def test_cannot_start_quest_with_non_friend(self):
        with self.assertRaisesRegex(ValueError, "friend_not_found"):
            database.create_friend_quest("alex-id", "sam-id", 100)


if __name__ == "__main__":
    unittest.main()
