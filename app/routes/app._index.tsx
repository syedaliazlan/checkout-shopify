import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <s-page heading="Checkout Validation">
      <s-section heading="About this app">
        <s-paragraph>
          This app validates customer emails during checkout. When a customer
          enters an email that belongs to an existing account, they are prompted
          to sign in before continuing. This ensures returning customers use
          their accounts for a better checkout experience.
        </s-paragraph>
      </s-section>

      <s-section heading="How it works">
        <s-unordered-list>
          <s-list-item>
            Monitors the email field during checkout in real-time
          </s-list-item>
          <s-list-item>
            Checks if the email belongs to an existing customer account
          </s-list-item>
          <s-list-item>
            Supports both classic (password-based) and new (passwordless)
            customer accounts — configure in Settings
          </s-list-item>
          <s-list-item>
            Skips validation if the customer is already logged in
          </s-list-item>
          <s-list-item>
            Blocks checkout and displays a message prompting the customer to
            sign in
          </s-list-item>
          <s-list-item>
            Fail-safe design: if anything goes wrong, checkout proceeds normally
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Developer">
        <s-paragraph>
          Developed by{" "}
          <s-link href="https://aliazlan.net" target="_blank">
            Ali Azlan
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-link href="https://aliazlan.net" target="_blank">
            aliazlan.net
          </s-link>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
