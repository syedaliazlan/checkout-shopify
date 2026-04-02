import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

// Query to find the Designer Pricing function
const FIND_FUNCTION_QUERY = `#graphql
  query FindCartTransformFunction {
    shopifyFunctions(first: 25) {
      nodes {
        id
        title
        apiType
      }
    }
  }
`;

// Query to check if a cart transform is already active
const LIST_CART_TRANSFORMS_QUERY = `#graphql
  query ListCartTransforms {
    cartTransforms(first: 10) {
      nodes {
        id
        functionId
      }
    }
  }
`;

// Mutation to activate the cart transform
const ACTIVATE_MUTATION = `#graphql
  mutation CartTransformCreate($functionId: String!) {
    cartTransformCreate(
      functionId: $functionId
      blockOnFailure: false
    ) {
      cartTransform {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // Find the function
  const functionsResponse = await admin.graphql(FIND_FUNCTION_QUERY);
  const functionsData = await functionsResponse.json();
  const functions = functionsData.data?.shopifyFunctions?.nodes || [];
  const designerFunction = functions.find(
    (f: any) => f.apiType === "cart_transform"
  );

  // Check existing cart transforms
  const transformsResponse = await admin.graphql(LIST_CART_TRANSFORMS_QUERY);
  const transformsData = await transformsResponse.json();
  const transforms = transformsData.data?.cartTransforms?.nodes || [];

  const isAlreadyActive = designerFunction
    ? transforms.some((t: any) => t.functionId === designerFunction.id)
    : false;

  return {
    designerFunction,
    isAlreadyActive,
    transforms,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const functionId = formData.get("functionId") as string;

  if (!functionId) {
    return { error: "No function ID provided" };
  }

  const response = await admin.graphql(ACTIVATE_MUTATION, {
    variables: { functionId },
  });
  const data = await response.json();

  if (data.data?.cartTransformCreate?.userErrors?.length > 0) {
    return {
      error: data.data.cartTransformCreate.userErrors
        .map((e: any) => e.message)
        .join(", "),
    };
  }

  if (data.data?.cartTransformCreate?.cartTransform?.id) {
    return {
      success: true,
      cartTransformId: data.data.cartTransformCreate.cartTransform.id,
    };
  }

  return { error: "Unknown error occurred" };
};

export default function ActivateCartTransform() {
  const { designerFunction, isAlreadyActive } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <s-page heading="Activate Designer Pricing" backAction={{ url: "/app" }}>
      <s-section heading="Cart Transform Function">
        {!designerFunction ? (
          <s-banner tone="critical">
            Designer Pricing function not found. Make sure you have deployed the
            app with <s-text fontWeight="bold">shopify app deploy</s-text>.
          </s-banner>
        ) : isAlreadyActive ? (
          <s-banner tone="success">
            Designer Pricing is already active! The Cart Transform function is
            running.
          </s-banner>
        ) : (
          <>
            <s-paragraph>
              Function found:{" "}
              <s-text fontWeight="bold">{designerFunction.title}</s-text> (
              {designerFunction.apiType})
            </s-paragraph>
            <s-paragraph>
              Click the button below to activate the Cart Transform function.
              This will enable designer pricing for Silver Designer and Silver Designer2 customers.
            </s-paragraph>
            <Form method="post">
              <input
                type="hidden"
                name="functionId"
                value={designerFunction.id}
              />
              <s-button variant="primary" type="submit">
                Activate Designer Pricing
              </s-button>
            </Form>
          </>
        )}

        {actionData?.success && (
          <s-banner tone="success">
            Designer Pricing activated successfully! Cart Transform ID:{" "}
            {actionData.cartTransformId}
          </s-banner>
        )}

        {actionData?.error && (
          <s-banner tone="critical">Error: {actionData.error}</s-banner>
        )}
      </s-section>
    </s-page>
  );
}
