import jwt from "jsonwebtoken";
import config from "../config.js";
import logger from "../logger.js";

function auth(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    logger.warn("No token provided");
    return res.sendStatus(401);
  }

  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) {
      logger.error("Token verification failed", err);
      return res.sendStatus(403);
    }

    req.headers[config.userHeader] = user.walletAddress;
    next();
  });
}

export default auth;
