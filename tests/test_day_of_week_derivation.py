import server


def test_day_of_week_is_derived_from_date():
    planned_date, hour, month, weekday, day_name = server._planned_fields("2026-08-03", "18:45")
    assert planned_date == "2026-08-03"
    assert (hour, month, weekday, day_name) == (18, 8, 0, "Monday")
