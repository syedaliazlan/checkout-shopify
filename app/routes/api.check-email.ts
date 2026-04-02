import type { LoaderFunctionArgs } from "react-router";
import { unauthenticated } from "../shopify.server";
import prisma from "../db.server";

function sanitizeEmail(email: string): string {
  return email.replace(/["\\]/g, "");
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const shop = url.searchParams.get("shop");

  if (!email || !shop) {
    return Response.json(
      { exists: false, error: "Missing email or shop" },
      { status: 400, headers: corsHeaders },
    );
  }

  const sanitized = sanitizeEmail(email.trim().toLowerCase());

  if (!sanitized) {
    return Response.json({ exists: false }, { headers: corsHeaders });
  }

  try {
    const { admin } = await unauthenticated.admin(shop);

    // Get the shop's account type setting
    const settings = await prisma.shopSettings.findUnique({
      where: { shop },
    });
    const accountType = settings?.accountType ?? "classic";

    const response = await admin.graphql(
      `#graphql
        query checkCustomerByEmail($query: String!) {
          customers(first: 1, query: $query) {
            edges {
              node {
                id
                state
                metafield(namespace: "custom", key: "isaccountactivated") {
                  value
                }
              }
            }
          }
        }
      `,
      {
        variables: {
          query: `email:"${sanitized}"`,
        },
      },
    );

    const data = await response.json();
    const customer = data.data?.customers?.edges?.[0]?.node;

    const isAccountActivated =
      customer?.metafield?.value?.toLowerCase() === "true";

    let shouldBlock = false;
    if (accountType === "classic") {
      // Classic accounts: block if customer state is ENABLED or metafield isAccountActivated is true
      shouldBlock = customer?.state === "ENABLED" || isAccountActivated;
    } else {
      // New accounts: block if any customer record exists (they can sign in via one-time code)
      shouldBlock = !!customer;
    }

    return Response.json({ exists: shouldBlock }, { headers: corsHeaders });
  } catch (error) {
    console.error("Customer lookup failed:", error);
    return Response.json({ exists: false }, { headers: corsHeaders });
  }
};
