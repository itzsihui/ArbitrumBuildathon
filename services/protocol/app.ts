import { Hono } from "hono";
import {
  handleAgentJson,
  handleBuy,
  handleCatalog,
  handleCheckout,
  handleLlmsTxt,
  handleOrder,
  handleReviews,
} from "../../src/lib/protocol/handlers";

export const protocolApp = new Hono();

protocolApp.get("/s/:slug/llms.txt", (c) => handleLlmsTxt(c.req.param("slug"), c.req.raw));
protocolApp.get("/s/:slug/agent.json", (c) => handleAgentJson(c.req.param("slug"), c.req.raw));
protocolApp.get("/s/:slug/catalog.json", (c) => handleCatalog(c.req.param("slug"), c.req.raw));
protocolApp.get("/s/:slug/reviews.json", (c) => handleReviews(c.req.param("slug"), c.req.raw));
protocolApp.post("/s/:slug/buy", (c) => handleBuy(c.req.param("slug"), c.req.raw));
protocolApp.post("/s/:slug/checkout", (c) => handleCheckout(c.req.param("slug"), c.req.raw));
protocolApp.get("/s/:slug/orders/:id", (c) =>
  handleOrder(c.req.param("slug"), c.req.param("id")),
);

export default protocolApp;
