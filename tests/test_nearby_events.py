import os
import sys
import unittest

from fastapi import HTTPException

sys.path.insert(
    0,
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
)
import app as app_module  # noqa: E402


class NearbyEventsTests(unittest.TestCase):
    def test_get_all_activities_without_location_filter(self):
        activities = app_module.get_activities()
        self.assertIn("Chess Club", activities)
        self.assertIn("latitude", activities["Chess Club"])
        self.assertIn("longitude", activities["Chess Club"])

    def test_returns_only_nearby_events_when_location_provided(self):
        activities = app_module.get_activities(
            latitude=47.6118,
            longitude=-122.3325,
            radius_km=1,
        )
        self.assertIn("Chess Club", activities)
        self.assertNotIn("Art Club", activities)

    def test_requires_both_latitude_and_longitude(self):
        with self.assertRaises(HTTPException) as exception_context:
            app_module.get_activities(latitude=47.6118, radius_km=10)
        self.assertEqual(exception_context.exception.status_code, 400)
        self.assertEqual(exception_context.exception.detail, "Both latitude and longitude are required for location filtering")


if __name__ == "__main__":
    unittest.main()
