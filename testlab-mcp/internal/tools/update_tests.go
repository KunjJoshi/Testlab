// internal/tools/update_test_row.go
package tools

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"github.com/KunjJoshi/testlab-mcp/internal/client"
)

func RegisterUpdateTestRowTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("update-test-row",
		mcp.WithDescription("Update fields on an existing test row, including marking its status"),
		mcp.WithNumber("row_id", mcp.Required()),
		mcp.WithString("test_name"),
		mcp.WithString("test_description"),
		mcp.WithString("execution_steps"),
		mcp.WithString("expected_output"),
		mcp.WithNumber("expected_response_status"),
		mcp.WithString("status", mcp.Description("untested, in_progress, passed, or failed")),
	)

	handler := newUpdateTestRowHandler(c)
	s.AddTool(tool, handler.Handle)
}

type updateTestRowHandler struct {
	client *client.Client
}

func newUpdateTestRowHandler(c *client.Client) *updateTestRowHandler {
	return &updateTestRowHandler{client: c}
}

func (h *updateTestRowHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	rowID, err := req.RequireInt("row_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	body := buildPatchBody(req.GetArguments(),
		"test_name", "test_description", "execution_steps", "expected_output",
		"expected_response_status", "status")

	resp, err := h.client.Patch(ctx, fmt.Sprintf("/tests/%d", rowID), body)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil
}
