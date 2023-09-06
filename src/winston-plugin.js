import winston from "winston";
import { LOG_LEVEL } from "./settings-provider.js";

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.metadata({ fillWith: ["object"] }),
    winston.format.colorize(),
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), // Add timestamps to log messages
    winston.format.printf(
      ({ timestamp, level, message, metadata: { object } }) => {
        return object
          ? `${timestamp} ${level}: ${message}\n${JSON.stringify(
              object,
              null,
              4
            )}`
          : `${timestamp} ${level}: ${message}`;
      }
    )
  ),
  transports: [new winston.transports.Console()],
});

winston.addColors({
  error: "red",
  warn: "yellow",
  info: "cyan",
  debug: "green",
});

export default logger;
