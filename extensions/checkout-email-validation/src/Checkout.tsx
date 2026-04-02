import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";

const DEBOUNCE_MS = 500;
const TIMEOUT_MS = 3000;

let _customerExists = false;

export default async () => {
  shopify.buyerJourney.intercept(({ canBlockProgress }) => {
    if (canBlockProgress && _customerExists) {
      return {
        behavior: "block",
        reason: "Email belongs to an existing customer account",
      };
    }
    return { behavior: "allow" };
  });

  render(<EmailValidation />, document.body);
};

function EmailValidation() {
  const [customerExists, setCustomerExists] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!shopify.buyerIdentity?.email) {
      console.warn("checkout-email-validation: buyerIdentity.email not available");
      return;
    }

    const unsubscribe = shopify.buyerIdentity.email.subscribe(
      (email: string | undefined) => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }

        setCustomerExists(false);
        _customerExists = false;

        if (!email || !email.includes("@") || !email.includes(".")) {
          return;
        }

        // Skip check if customer is already logged in
        if (shopify.buyerIdentity?.customer?.current) {
          return;
        }

        debounceRef.current = setTimeout(() => {
          checkEmail(email);
        }, DEBOUNCE_MS);
      },
    );

    return () => {
      unsubscribe();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  async function checkEmail(emailToCheck: string) {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const appUrl = "https://checkout-validation.onrender.com";
      const response = await fetch(
        `${appUrl}/api/check-email?email=${encodeURIComponent(emailToCheck)}&shop=${shopify.shop.myshopifyDomain}`,
        { signal: controller.signal },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        setCustomerExists(false);
        _customerExists = false;
        return;
      }

      const data = await response.json();

      if (!controller.signal.aborted) {
        const exists = data.exists === true;
        setCustomerExists(exists);
        _customerExists = exists;
      }
    } catch {
      if (!controller.signal.aborted) {
        setCustomerExists(false);
        _customerExists = false;
      }
    }
  }

  if (customerExists) {
    return (
      <s-banner tone="critical">
        This email is associated with an existing account. Please use the "Sign in" link above to log in before continuing checkout.
      </s-banner>
    );
  }

  return null;
}
