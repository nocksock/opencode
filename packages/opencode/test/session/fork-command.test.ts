import { describe, test, expect } from "bun:test"
import { Command } from "@/command"
import { Instance } from "@/project/instance"
import { tmpdir } from "../fixture/fixture"

describe("/fork command", () => {
  test("should be registered as a default command", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const command = await Command.get(Command.Default.FORK)
        expect(command).toBeDefined()
        expect(command.name).toBe("fork")
      },
    })
  })

  test("should fork session without arguments", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const { Session } = await import("@/session")
        const { SessionPrompt } = await import("@/session/prompt")

        // Create original session
        const originalSession = await Session.create({})

        // Execute /fork command
        const result = await SessionPrompt.command({
          sessionID: originalSession.id,
          command: Command.Default.FORK,
          arguments: "",
        })

        expect(result).toBeDefined()

        // The result should be from the forked session, not the original
        expect(result.info.sessionID).not.toBe(originalSession.id)

        // Verify forked session exists and has parentID
        const forkedSession = await Session.get(result.info.sessionID)
        expect(forkedSession.parentID).toBe(originalSession.id)
      },
    })
  })

  test("should fork and send message when arguments provided", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const { Session } = await import("@/session")
        const { SessionPrompt } = await import("@/session/prompt")

        // Create original session
        const originalSession = await Session.create({})
        const testMessage = "Continue with this feature"

        // Execute /fork command with message
        const result = await SessionPrompt.command({
          sessionID: originalSession.id,
          command: Command.Default.FORK,
          arguments: testMessage,
        })

        // Verify forked session created
        const forkedSession = await Session.get(result.info.sessionID)
        expect(forkedSession.parentID).toBe(originalSession.id)

        // Verify message was sent in forked session
        const messages = await Session.messages({
          sessionID: forkedSession.id,
        })

        expect(messages.length).toBeGreaterThan(0)

        // Find the user message with our test message
        const userMessage = messages.find((m) => m.info.role === "user")
        expect(userMessage).toBeDefined()

        const textParts = userMessage!.parts.filter((p) => p.type === "text")
        expect(textParts.some((p) => p.text.includes(testMessage))).toBe(true)
      },
    })
  })
})
