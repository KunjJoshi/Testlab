package tools

import (
	"context"
	"fmt"

	"github.com/KunjJoshi/testlab-mcp/internal/client"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func RegisterPromoteSuiteTool(s *server.MCPServer, c *client.Client) {
	tool := mcp.NewTool("promote-suite",
		mcp.WithDescription("This tool allows promoting a suite to a new environment by Environment ID"),
		mcp.WithNumber("suite_id", mcp.Required(), mcp.Description("ID of the Suite which is getting its Environment Changed")),
		mcp.WithNumber("environment_id", mcp.Required(), mcp.Description("ID of the new environment which would be updated for the suite")),
	)

	handler := newPromoteSuiteHandler(c)
	s.AddTool(tool, handler.Handle)
}

type promoteSuiteHandler struct {
	client *client.Client
}

func newPromoteSuiteHandler(client *client.Client) *promoteSuiteHandler {
	return &promoteSuiteHandler{client: client}
}

func (h *promoteSuiteHandler) Handle(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	suiteID, err := req.RequireInt("suite_id")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	body := map[string]any{}
	args := req.GetArguments()
	if v, ok := args["environment_id"]; ok {
		body["environment_id"] = v
	}

	resp, err := h.client.Patch(ctx, fmt.Sprintf("/suites/promote-environment/%d", suiteID), body)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	return mcp.NewToolResultText(string(resp)), nil

}
