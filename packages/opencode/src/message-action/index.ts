import z from "zod"
import { Identifier } from "../id/id"
import { Session } from "../session"
import { Config } from "../config/config"
import { fn } from "../util/fn"
import { Log } from "../util/log"
import { spawn } from "child_process"
import { promisify } from "util"

export namespace MessageAction {
  const log = Log.create({ service: "message-action" })

  export const Info = z
    .object({
      label: z.string(),
      description: z.string().optional(),
      command: z.string().array(),
      environment: z.record(z.string(), z.string()).optional(),
    })
    .meta({
      ref: "MessageActionInfo",
    })
  export type Info = z.infer<typeof Info>

  export const ExecuteResult = z.object({
    success: z.boolean(),
    exitCode: z.number(),
    stdout: z.string(),
    stderr: z.string(),
    error: z.string().optional(),
  })
  export type ExecuteResult = z.infer<typeof ExecuteResult>

  export async function list(): Promise<Info[]> {
    const config = await Config.get()
    return config.messageActions ?? []
  }

  export const execute = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
      action: Info,
    }),
    async (input): Promise<ExecuteResult> => {
      log.info("execute", { sessionID: input.sessionID, messageID: input.messageID, label: input.action.label })

      try {
        // Get session to determine working directory
        const session = await Session.get(input.sessionID)

        // Build command with session-id and message-id as arguments
        const commandArgs = [...input.action.command.slice(1), input.sessionID, input.messageID]

        // Execute command
        const result = await new Promise<ExecuteResult>((resolve) => {
          const proc = spawn(input.action.command[0], commandArgs, {
            cwd: session.directory,
            env: {
              ...process.env,
              ...input.action.environment,
            },
          })

          let stdout = ""
          let stderr = ""

          proc.stdout?.on("data", (data) => {
            stdout += data.toString()
          })

          proc.stderr?.on("data", (data) => {
            stderr += data.toString()
          })

          proc.on("close", (code) => {
            resolve({
              success: code === 0,
              exitCode: code ?? -1,
              stdout,
              stderr,
            })
          })

          proc.on("error", (err) => {
            resolve({
              success: false,
              exitCode: -1,
              stdout,
              stderr,
              error: err.message,
            })
          })
        })

        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        log.error("execute failed", { error: errorMessage })
        return {
          success: false,
          exitCode: -1,
          stdout: "",
          stderr: "",
          error: errorMessage,
        }
      }
    },
  )
}
