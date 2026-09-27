// internal/tools/create_test_row.go
package tools

import (
	"context"
	"encoding/json"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"github.com/KunjJoshi/testlab-mcp/internal/client"
)

func RegisterCreateTestRowTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("create-test-row",
		mcp.WithDescription("Add a single test row to an existing test suite"),
		mcp.WithNumber("parent_suite", mcp.Required(), mcp.Description("The suite ID this row belongs to")),
		mcp.WithString("test_name", mcp.Required()),
		mcp.WithString("test_description", mcp.Required()),
		mcp.WithString("execution_steps", mcp.Description("Step-by-step instructions to run this test")),
		mcp.WithString("expected_output", mcp.Required()),
		mcp.WithNumber("expected_response_status", mcp.Description("Expected HTTP status code, if applicable")),
	)

	handler := newCreateTestRowHandler(c)
	s.AddTool(tool, handler.Handle)
}

type createTestRowHandler struct {
	client *client.Client
}

func newCreateTestRowHandler(c *client.Client) *createTestRowHandler {
	return &createTestRowHandler{client: c}
}

func (h *createTestRowHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	parentSuite, err := req.RequireInt("parent_suite")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	testName, err := req.RequireString("test_name")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	testDescription, err := req.RequireString("test_description")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	expectedOutput, err := req.RequireString("expected_output")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	executionSteps := req.GetString("execution_steps", "")
	expectedStatus := req.GetInt("expected_response_status", 0)

	body := map[string]any{
		"parent_suite":             parentSuite,
		"test_name":                testName,
		"test_description":         testDescription,
		"execution_steps":          executionSteps,
		"expected_output":          expectedOutput,
		"expected_response_status": expectedStatus,
	}

	resp, err := h.client.Post("/tests/write-test", body)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil
}

func RegisterBulkImportTestRowsTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("bulk-import-test-rows",
		mcp.WithDescription("Import multiple test rows into a suite at once. "+
			"test_rows_json must be a JSON array of objects, each with: "+
			"test_name (string, required), test_description (string, required), "+
			"execution_steps (string), expected_output (string, required), "+
			"expected_response_status (number)."),
		mcp.WithNumber("parent_suite_id", mcp.Required()),
		mcp.WithString("test_rows_json", mcp.Required()),
	)

	handler := newBulkImportTestRowsHandler(c)
	s.AddTool(tool, handler.Handle)
}

type bulkImportTestRowsHandler struct {
	client *client.Client
}

func newBulkImportTestRowsHandler(c *client.Client) *bulkImportTestRowsHandler {
	return &bulkImportTestRowsHandler{client: c}
}

func (h *bulkImportTestRowsHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	parentSuiteID, err := req.RequireInt("parent_suite_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	testRowsJSON, err := req.RequireString("test_rows_json")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	testRows, err := parseTestRowsJSON(testRowsJSON)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	body := map[string]any{
		"parent_suite_id": parentSuiteID,
		"test_rows":       testRows,
	}

	resp, err := h.client.Post("/tests/import-bulk", body)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil
}

func parseTestRowsJSON(raw string) ([]map[string]any, error) {
	var testRows []map[string]any
	if err := json.Unmarshal([]byte(raw), &testRows); err != nil {
		return nil, err
	}
	return testRows, nil
}
