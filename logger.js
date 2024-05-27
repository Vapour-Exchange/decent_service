import winston from "winston";
import NewrelicTransport from "winston-newrelic-agent-transport";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};
if (process.env.Env != "DEV") {
  const options = {};
  logger.add(new NewrelicTransport(options));
}

export default logger;
