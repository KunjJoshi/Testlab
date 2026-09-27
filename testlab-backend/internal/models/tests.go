package models

import "time"

type TestSuite struct {
	SuiteID          int       `json:"suite_id"`
	SuiteName        string    `json:"suite_name"`
	SuiteDescription string    `json:"suite_description"`
	OwnerID          int       `json:"owner_id"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type TestRow struct {
	RowID                  int       `json:"row_id"`
	TestName               string    `json:"test_name"`
	TestDescription        string    `json:"test_description"`
	ParentSuite            int       `json:"parent_suite"`
	ExpectedOutput         string    `json:"expected_output"`
	ExpectedResponseStatus int       `json:"expected_response_status"`
	Response               string    `json:"response"`
	ResponseStatus         int       `json:"response_status"`
	ExecutionSteps         string    `json:"execution_steps"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}
