import { registerTool } from "../../core/tool-registry.js";
import { createPaymentLink } from "../../connectors/stripe.js";

registerTool(
  { name: "create_payment_link", description: "Create a Stripe payment link.", input_schema: { type: "object" as const, properties: { amount: { type: "number", description: "Amount in cents" }, description: { type: "string" }, currency: { type: "string" }, customer_name: { type: "string" } }, required: ["amount","description"] } },
  async (input) => {
    try {
      const url = await createPaymentLink(input.amount, input.description, input.currency || "usd");
      const formatted = (input.amount / 100).toFixed(2);
      return "Payment link: $" + formatted + " " + (input.currency || "USD").toUpperCase() + "\n" + url;
    } catch (e: any) { return "Error: " + e.message; }
  }
);

registerTool(
  { name: "send_payment_reminder", description: "Format a payment reminder message.", input_schema: { type: "object" as const, properties: { phone: { type: "string" }, amount: { type: "string" }, description: { type: "string" }, link: { type: "string" } }, required: ["phone","amount","description","link"] } },
  async (input) => {
    return "Mensaje de cobro para " + input.phone + ":\n\nHola! Recordatorio de pago de *" + input.description + "* por *" + input.amount + "*.\n\nPaga aqui: " + input.link;
  }
);
