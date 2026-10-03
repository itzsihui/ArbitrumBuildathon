import { handle } from "hono/aws-lambda";
import { protocolApp } from "./app";

protocolApp.get("/health", (c) =>
  c.json({
    ok: true,
    service: "aisle-protocol",
    table: process.env.AISLE_TABLE ?? null,
    network: process.env.BASE_NETWORK ?? process.env.AVALANCHE_NETWORK ?? null,
  }),
);

export const handler = handle(protocolApp);
