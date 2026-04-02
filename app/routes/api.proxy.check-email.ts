import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

function sanitizeEmail(email: string): string {
  return email.replace(/["\\]/g, "");
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Set CORS headers for checkout extension requests
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const { admin } = await authenticate.public.appProxy(request);

    if (!admin) {
      console.error("No admin session found for app proxy request");
      return Response.json({ exists: false }, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const email = url.searchParams.get("email");

    if (!email) {
      return Response.json(
        { exists: false, error: "Missing email" },
        { status: 400, headers: corsHeaders },
      );
    }

    const sanitized = sanitizeEmail(email.trim().toLowerCase());

    if (!sanitized) {
      return Response.json({ exists: false }, { headers: corsHeaders });
    }

    const response = await admin.graphql(
      `#graphql
        query checkCustomerByEmail($query: String!) {
          customers(first: 1, query: $query) {
            edges {
              node {
                id
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
    const exists = (data.data?.customers?.edges?.length ?? 0) > 0;

    return Response.json({ exists }, { headers: corsHeaders });
  } catch (error) {
    console.error("Proxy route error:", error);
    // Fail-safe: if auth throws (e.g., no session after redeploy), allow checkout
    return Response.json({ exists: false }, { headers: corsHeaders });
  }
};
