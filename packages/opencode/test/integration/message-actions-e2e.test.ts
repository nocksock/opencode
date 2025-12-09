import { describe, test, expect } from "bun:test"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Storage } from "@/storage/storage"
import { MessageAction } from "@/message-action"
import { tmpdir } from "../fixture/fixture"
import path from "path"

describe("Message Actions End-to-End", () => {
  test("should execute custom action from config on specific message", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        // Create a test script that writes its args to a file
        const scriptPath = path.join(dir, "test-action.sh")
        await Bun.write(
          scriptPath,
          `#!/usr/bin/env bash
echo "Session: $1, Message: $2" > ${path.join(dir, "output.txt")}
exit 0
`,
        )
        await Bun.$`chmod +x ${scriptPath}`

        // Create config with custom action
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            messageActions: [
              {
                command: [scriptPath],
                label: "Test Action",
                description: "A test action for E2E",
              },
            ],
          }),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // 1. Create session with message
        const session = await Session.create({})
        await Storage.write(["session", Instance.project.id, session.id], session)

        const messageID = "msg_test123"

        // 2. Load config and verify action exists
        const actions = await MessageAction.list()
        expect(actions.length).toBe(1)
        expect(actions[0].label).toBe("Test Action")

        // 3. Execute action via MessageAction.execute
        const result = await MessageAction.execute({
          sessionID: session.id,
          messageID,
          action: actions[0],
        })

        // 4. Verify command was called with correct args
        expect(result.success).toBe(true)
        expect(result.exitCode).toBe(0)

        // 5. Verify output file was created with correct content
        const outputPath = path.join(tmp.path, "output.txt")
        const output = await Bun.file(outputPath).text()
        expect(output.trim()).toBe(`Session: ${session.id}, Message: ${messageID}`)
      },
    })
  })

  test("should handle action failures gracefully", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        // Create a failing script
        const scriptPath = path.join(dir, "fail-action.sh")
        await Bun.write(
          scriptPath,
          `#!/usr/bin/env bash
echo "Error message" >&2
exit 1
`,
        )
        await Bun.$`chmod +x ${scriptPath}`

        // Create config with failing action
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            messageActions: [
              {
                command: [scriptPath],
                label: "Failing Action",
              },
            ],
          }),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        await Storage.write(["session", Instance.project.id, session.id], session)

        const actions = await MessageAction.list()
        expect(actions.length).toBe(1)

        // Execute failing action
        const result = await MessageAction.execute({
          sessionID: session.id,
          messageID: "msg_test456",
          action: actions[0],
        })

        // Verify failure is captured correctly
        expect(result.success).toBe(false)
        expect(result.exitCode).toBe(1)
        expect(result.stderr).toContain("Error message")
      },
    })
  })

  test("should pass environment variables to action", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        // Create a script that uses environment variables
        const scriptPath = path.join(dir, "env-action.sh")
        await Bun.write(
          scriptPath,
          `#!/usr/bin/env bash
echo "Custom: $CUSTOM_VAR" > ${path.join(dir, "env-output.txt")}
exit 0
`,
        )
        await Bun.$`chmod +x ${scriptPath}`

        // Create config with environment variables
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            messageActions: [
              {
                command: [scriptPath],
                label: "Env Action",
                environment: {
                  CUSTOM_VAR: "test-value-123",
                },
              },
            ],
          }),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        await Storage.write(["session", Instance.project.id, session.id], session)

        const actions = await MessageAction.list()
        expect(actions.length).toBe(1)

        // Execute action with environment variables
        const result = await MessageAction.execute({
          sessionID: session.id,
          messageID: "msg_test789",
          action: actions[0],
        })

        expect(result.success).toBe(true)
        expect(result.exitCode).toBe(0)

        // Verify environment variable was passed correctly
        const outputPath = path.join(tmp.path, "env-output.txt")
        const output = await Bun.file(outputPath).text()
        expect(output.trim()).toBe("Custom: test-value-123")
      },
    })
  })
})
