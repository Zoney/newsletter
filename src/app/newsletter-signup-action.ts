"use server";

import mailchimpClient from "@/lib/mailchimp";

export const signup = async (email: string) => {
  console.log("Email:", email);
  try {
    const mailchimpListClientId = process.env.MAILCHIMP_LIST_CLIENT_ID;
    if (!mailchimpListClientId) {
      throw new Error("MAILCHIMP_LIST_CLIENT_ID is not defined");
    }
    const response = await mailchimpClient.lists.addListMember(mailchimpListClientId, {
      email_address: email,
      status: "subscribed",
    });
    if (response.status !== "subscribed") {
      return {
        success: false,
      };
    }
    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
    };
  }
};
