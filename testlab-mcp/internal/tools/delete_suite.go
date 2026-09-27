// internal/tools/delete_suite.go
package tools

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"github.com/KunjJoshi/testlab-mcp/internal/client"
)

func RegisterDeleteSuiteTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("delete-suite",
		mcp.WithDescription("Delete a test suite and all its test rows"),
		mcp.WithNumber("suite_id", mcp.Required(), mcp.Description("The suite's ID")),
	)

	handler := newDeleteSuiteHandler(c)
	s.AddTool(tool, handler.Handle)
}

type deleteSuiteHandler struct {
	client *client.Client
}

func newDeleteSuiteHandler(c *client.Client) *deleteSuiteHandler {
	return &deleteSuiteHandler{client: c}
}

func (h *deleteSuiteHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	suiteID, err := req.RequireInt("suite_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	resp, err := h.client.Delete(fmt.Sprintf("/suites/%d", suiteID), nil)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil
}
