import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useSubmit } from "react-router";
import { useEffect, useRef } from "react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const settings = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
  });

  return { accountType: settings?.accountType ?? "classic" };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const accountType = formData.get("accountType") as string;

  if (accountType !== "classic" && accountType !== "new") {
    return { error: "Invalid account type" };
  }

  await prisma.shopSettings.upsert({
    where: { shop: session.shop },
    update: { accountType },
    create: { shop: session.shop, accountType },
  });

  return { success: true };
};

export default function Settings() {
  const { accountType } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const selectRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = selectRef.current;
    if (!el) return;

    const handleChange = () => {
      const value = (el as any).value;
      if (value && value !== accountType) {
        const formData = new FormData();
        formData.set("accountType", value);
        submit(formData, { method: "post" });
      }
    };

    el.addEventListener("change", handleChange);
    return () => el.removeEventListener("change", handleChange);
  }, [accountType, submit]);

  return (
    <s-page heading="Settings">
      <s-section heading="Customer account type">
        <s-paragraph>
          Select the type of customer accounts your store uses. This determines
          how the app identifies customers who need to sign in at checkout.
        </s-paragraph>

        <s-box padding-block-start="base">
          <s-select
            ref={selectRef}
            label="Account type"
            value={accountType}
          >
            <s-option value="classic">
              Classic accounts (password-based)
            </s-option>
            <s-option value="new">
              New customer accounts (passwordless / one-time code)
            </s-option>
          </s-select>
        </s-box>

        <s-box padding-block-start="base">
          {accountType === "classic" ? (
            <s-banner tone="info">
              Only customers with an active account (status: enabled) will be
              prompted to sign in. Guests can checkout freely.
            </s-banner>
          ) : (
            <s-banner tone="info">
              Any customer with an existing record will be prompted to sign in
              via one-time code. First-time guests can checkout freely.
            </s-banner>
          )}
        </s-box>
      </s-section>

      <s-section slot="aside" heading="How it works">
        <s-paragraph>
          <s-text tone="emphasis">Classic accounts:</s-text> Customers register
          with a password. The app checks if the account status is "enabled."
        </s-paragraph>
        <s-paragraph>
          <s-text tone="emphasis">New accounts:</s-text> Customers sign in with
          a one-time email code. The app checks if a customer record exists.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
