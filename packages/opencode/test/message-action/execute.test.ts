import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MessageAction } from "@/message-action"
import { Session } from "@/session"
import { Storage } from "@/storage/storage"
import { Instance } from "@/project/instance"
import { tmpdir } from "../fixture/fixture"
import path from "path"
import { mkdtemp } from "fs/promises"
import os from "os"

describe("MessageAction.execute", () => {
  let tempDir: string
  let sessionID: string
  let messageID: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "opencode-test-"))
    sessionID = "ses_test123"
    messageID = "msg_test456"
  })

  afterEach(async () => {
    // Cleanup will be done within Instance.provide context
  })

  test("should execute command with session-id and message-id", async () => {
    await Instance.provide({
      directory: tempDir,
      fn: async () => {
        // Create session within Instance context
        await Storage.write(["session", Instance.project.id, sessionID], {
          id: sessionID,
          projectID: Instance.project.id,
          directory: tempDir,
          title: "Test Session",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        })

        const action: MessageAction.Info = {
          command: ["echo", "test"],
          label: "Echo Test",
        }

        const result = await MessageAction.execute({
          sessionID,
          messageID,
          action,
        })

        // Cleanup
        await Storage.remove(["session", Instance.project.id, sessionID])

        expect(result.success).toBe(true)
        expect(result.exitCode).toBe(0)
      },
    })
  })

  test("should capture stdout and stderr", async () => {
    await Instance.provide({
      directory: tempDir,
      fn: async () => {
        // Create session within Instance context
        await Storage.write(["session", Instance.project.id, sessionID], {
          id: sessionID,
          projectID: Instance.project.id,
          directory: tempDir,
          title: "Test Session",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        })

        const action: MessageAction.Info = {
          command: ["bash", "-c", "echo 'stdout message' && echo 'stderr message' >&2"],
          label: "Output Test",
        }

        const result = await MessageAction.execute({
          sessionID,
          messageID,
          action,
        })

        // Cleanup
        await Storage.remove(["session", Instance.project.id, sessionID])

        expect(result.success).toBe(true)
        expect(result.stdout).toContain("stdout message")
        expect(result.stderr).toContain("stderr message")
      },
    })
  })

  test("should run command in session directory", async () => {
    await Instance.provide({
      directory: tempDir,
      fn: async () => {
        // Create session within Instance context
        await Storage.write(["session", Instance.project.id, sessionID], {
          id: sessionID,
          projectID: Instance.project.id,
          directory: tempDir,
          title: "Test Session",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        })

        const action: MessageAction.Info = {
          command: ["bash", "-c", "pwd"],
          label: "CWD Test",
        }

        const result = await MessageAction.execute({
          sessionID,
          messageID,
          action,
        })

        // Cleanup
        await Storage.remove(["session", Instance.project.id, sessionID])

        expect(result.success).toBe(true)
        expect(result.stdout.trim()).toBe(tempDir)
      },
    })
  })

  test("should pass session-id as $1 and message-id as $2", async () => {
    await Instance.provide({
      directory: tempDir,
      fn: async () => {
        // Create session within Instance context
        await Storage.write(["session", Instance.project.id, sessionID], {
          id: sessionID,
          projectID: Instance.project.id,
          directory: tempDir,
          title: "Test Session",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        })

        const action: MessageAction.Info = {
          command: ["bash", "-c", 'echo "$1|$2"', "--"],
          label: "Args Test",
        }

        const result = await MessageAction.execute({
          sessionID,
          messageID,
          action,
        })

        // Cleanup
        await Storage.remove(["session", Instance.project.id, sessionID])

        expect(result.success).toBe(true)
        expect(result.stdout.trim()).toBe(`${sessionID}|${messageID}`)
      },
    })
  })

  test("should include environment variables", async () => {
    await Instance.provide({
      directory: tempDir,
      fn: async () => {
        // Create session within Instance context
        await Storage.write(["session", Instance.project.id, sessionID], {
          id: sessionID,
          projectID: Instance.project.id,
          directory: tempDir,
          title: "Test Session",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        })

        const action: MessageAction.Info = {
          command: ["bash", "-c", "echo $CUSTOM_VAR"],
          label: "Env Test",
          environment: {
            CUSTOM_VAR: "test_value",
          },
        }

        const result = await MessageAction.execute({
          sessionID,
          messageID,
          action,
        })

        // Cleanup
        await Storage.remove(["session", Instance.project.id, sessionID])

        expect(result.success).toBe(true)
        expect(result.stdout.trim()).toBe("test_value")
      },
    })
  })

  test("should preserve additional command arguments", async () => {
    await Instance.provide({
      directory: tempDir,
      fn: async () => {
        // Create session within Instance context
        await Storage.write(["session", Instance.project.id, sessionID], {
          id: sessionID,
          projectID: Instance.project.id,
          directory: tempDir,
          title: "Test Session",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        })

        const action: MessageAction.Info = {
          command: ["echo", "arg1", "arg2"],
          label: "Args Test",
        }

        const result = await MessageAction.execute({
          sessionID,
          messageID,
          action,
        })

        // Cleanup
        await Storage.remove(["session", Instance.project.id, sessionID])

        expect(result.success).toBe(true)
        expect(result.stdout).toContain("arg1")
        expect(result.stdout).toContain("arg2")
      },
    })
  })

  test("should handle non-existent command gracefully", async () => {
    await Instance.provide({
      directory: tempDir,
      fn: async () => {
        // Create session within Instance context
        await Storage.write(["session", Instance.project.id, sessionID], {
          id: sessionID,
          projectID: Instance.project.id,
          directory: tempDir,
          title: "Test Session",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        })

        const action: MessageAction.Info = {
          command: ["/path/to/nonexistent/command"],
          label: "Fail Test",
        }

        const result = await MessageAction.execute({
          sessionID,
          messageID,
          action,
        })

        // Cleanup
        await Storage.remove(["session", Instance.project.id, sessionID])

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      },
    })
  })

  test("should handle command that exits with error code", async () => {
    await Instance.provide({
      directory: tempDir,
      fn: async () => {
        // Create session within Instance context
        await Storage.write(["session", Instance.project.id, sessionID], {
          id: sessionID,
          projectID: Instance.project.id,
          directory: tempDir,
          title: "Test Session",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        })

        const action: MessageAction.Info = {
          command: ["bash", "-c", "exit 1"],
          label: "Exit Code Test",
        }

        const result = await MessageAction.execute({
          sessionID,
          messageID,
          action,
        })

        // Cleanup
        await Storage.remove(["session", Instance.project.id, sessionID])

        expect(result.success).toBe(false)
        expect(result.exitCode).toBe(1)
      },
    })
  })

  test("should handle missing session", async () => {
    await Instance.provide({
      directory: tempDir,
      fn: async () => {
        const action: MessageAction.Info = {
          command: ["echo", "test"],
          label: "Missing Session Test",
        }

        const result = await MessageAction.execute({
          sessionID: "ses_nonexistent",
          messageID,
          action,
        })

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      },
    })
  })
})

describe("MessageAction.list", () => {
  test("should return empty array when no messageActions configured", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opencode-test-"))

    await Instance.provide({
      directory: tempDir,
      fn: async () => {
        const actions = await MessageAction.list()
        expect(actions).toEqual([])
      },
    })
  })

  test("should return configured message actions", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            messageActions: [
              {
                command: ["test-script.sh"],
                label: "Test Action",
                description: "A test action",
              },
              {
                command: ["another-script.sh"],
                label: "Another Action",
              },
            ],
          }),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const actions = await MessageAction.list()
        expect(Array.isArray(actions)).toBe(true)
        expect(actions.length).toBe(2)
        expect(actions[0].label).toBe("Test Action")
        expect(actions[0].description).toBe("A test action")
        expect(actions[1].label).toBe("Another Action")
      },
    })
  })
})

describe("MessageAction Variable Substitution", () => {
  test("should substitute variables in command", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sessionID = "ses_var_test"
        const messageID = "msg_var_test"

        await Storage.write(["session", Instance.project.id, sessionID], {
          id: sessionID,
          projectID: Instance.project.id,
          directory: tmp.path,
          title: "Var Test Session",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        })

        const outputFile = path.join(tmp.path, "var-output.txt")
        const action: MessageAction.Info = {
          command: ["sh", "-c", `echo "session=$session_id message=$message_id" > ${outputFile}`],
          label: "Var Test",
        }

        const result = await MessageAction.execute({
          sessionID,
          messageID,
          action,
        })

        expect(result.success).toBe(true)
        const output = await Bun.file(outputFile).text()
        expect(output.trim()).toBe(`session=${sessionID} message=${messageID}`)
      },
    })
  })

  test("should substitute ${var} syntax", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sessionID = "ses_brace_test"
        const messageID = "msg_brace_test"

        await Storage.write(["session", Instance.project.id, sessionID], {
          id: sessionID,
          projectID: Instance.project.id,
          directory: tmp.path,
          title: "Brace Test",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        })

        const outputFile = path.join(tmp.path, "brace-output.txt")
        const action: MessageAction.Info = {
          command: ["sh", "-c", `echo "\${session_id} \${message_id}" > ${outputFile}`],
          label: "Brace Test",
        }

        const result = await MessageAction.execute({
          sessionID,
          messageID,
          action,
        })

        expect(result.success).toBe(true)
        const output = await Bun.file(outputFile).text()
        expect(output.trim()).toBe(`${sessionID} ${messageID}`)
      },
    })
  })

  test("should substitute environment variables", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sessionID = "ses_env_test"
        const messageID = "msg_env_test"

        await Storage.write(["session", Instance.project.id, sessionID], {
          id: sessionID,
          projectID: Instance.project.id,
          directory: tmp.path,
          title: "Env Test",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        })

        const outputFile = path.join(tmp.path, "env-output.txt")
        const action: MessageAction.Info = {
          command: ["sh", "-c", `echo "$MY_VAR" > ${outputFile}`],
          label: "Env Test",
          environment: {
            MY_VAR: "session=$session_id,message=$message_id",
          },
        }

        const result = await MessageAction.execute({
          sessionID,
          messageID,
          action,
        })

        expect(result.success).toBe(true)
        const output = await Bun.file(outputFile).text()
        expect(output.trim()).toBe(`session=${sessionID},message=${messageID}`)
      },
    })
  })

  test("should handle fork command example", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sessionID = "ses_fork_test"
        const messageID = "msg_fork_test"

        await Storage.write(["session", Instance.project.id, sessionID], {
          id: sessionID,
          projectID: Instance.project.id,
          directory: tmp.path,
          title: "Fork Test",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        })

        const outputFile = path.join(tmp.path, "fork-output.txt")
        const action: MessageAction.Info = {
          command: ["sh", "-c", `echo "opencode session fork $session_id -m $message_id" > ${outputFile}`],
          label: "Fork Test",
        }

        const result = await MessageAction.execute({
          sessionID,
          messageID,
          action,
        })

        expect(result.success).toBe(true)
        const output = await Bun.file(outputFile).text()
        expect(output.trim()).toBe(`opencode session fork ${sessionID} -m ${messageID}`)
      },
    })
  })
})
