import express from "express";
import cors from "cors";
import config from "./config.js";
import logger from "./logger.js";
import auth from "./middleware/auth.js";
import swapRouter from "./routes/uniSwap.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// app.use(auth);
app.use("/uniswap", swapRouter);

app.listen(config.port, () => {
  logger.info(
    `[Server] : Server is running on http://localhost:${config.port}`
  );
});
