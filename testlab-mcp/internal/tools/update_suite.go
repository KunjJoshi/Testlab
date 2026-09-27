// internal/tools/update_suite.go
package tools

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"github.com/KunjJoshi/testlab-mcp/internal/client"
)

func RegisterUpdateSuiteTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("update-suite",
		mcp.WithDescription("Update a test suite's name or description"),
		mcp.WithNumber("suite_id", mcp.Required(), mcp.Description("The suite's ID")),
		mcp.WithString("suite_name", mcp.Description("New name, if changing it")),
		mcp.WithString("suite_description", mcp.Description("New description, if changing it")),
	)

	handler := newUpdateSuiteHandler(c)
	s.AddTool(tool, handler.Handle)
}

type updateSuiteHandler struct {
	client *client.Client
}

func newUpdateSuiteHandler(c *client.Client) *updateSuiteHandler {
	return &updateSuiteHandler{client: c}
}

func (h *updateSuiteHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	suiteID, err := req.RequireInt("suite_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	body := map[string]any{}
	args := req.GetArguments()
	if v, ok := args["suite_name"]; ok {
		body["suite_name"] = v
	}
	if v, ok := args["suite_description"]; ok {
		body["suite_description"] = v
	}

	resp, err := h.client.Patch(fmt.Sprintf("/suites/%d", suiteID), body)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil
}
