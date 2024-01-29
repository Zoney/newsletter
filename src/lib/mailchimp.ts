import mailchimp from "@mailchimp/mailchimp_marketing";

const mailchimpClient = mailchimp;
mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX,
});
export default mailchimpClient;
