import schemathesis
from schemathesis.checks import CHECKS


def is_paginated(operation):
	return any(parameter.name == "cursor" for parameter in operation.query)


def is_invalid_cursor_response(response):
	if response.status_code != 422:
		return False

	body = response.json()
	return isinstance(body, dict) and body.get("code") == "invalid-cursor"


default_positive_data_acceptance = CHECKS.get_one("positive_data_acceptance")
CHECKS.unregister("positive_data_acceptance")


@schemathesis.check
def positive_data_acceptance(ctx, response, case):
	query = case.query or {}
	if (
		is_paginated(case.operation)
		and "cursor" in query
		and is_invalid_cursor_response(response)
	):
		return None

	return default_positive_data_acceptance(ctx, response, case)
