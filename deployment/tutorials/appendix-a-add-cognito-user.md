## Appendix A: adding user to Media2Cloud web portal with Amazon Cognito User Pool service

This tutorial describes how you can create new user and grant permission to access Media2Cloud web portal.

----

### Step 1: Amazon Cognito service
Under _AWS Management console_, choose **Amazon Cognito service** and select _Manage User Pools_

![Cognito user pools](./images/cognito-user-pools.png)

--

### Step 2: Select Media2Cloud user pool
You should see two user pools created by Media2Cloud: one for your labeling workteam and one for Media2Cloud web portal.
Select the user pool suffixed with **-userpool**. (The name convention is SO0050-**<StackName>**-userpool)

![Choose user pool](./images/cognito-choose-user-pool.png)

--

### Step 3: Create new user
Under _General settings_, select **Users and groups**. Click on **Create user**.

![Create user](./images/cognito-create-user.png)

--

### Step 4: Fill in user details
Fill in the following information:
| Field | Description | Required? |
|:------|:------------|:----------|
| Username | your log in name to Media2Cloud web portal | Yes |
| Send an invitation to this new user? | Make sure **Email** is **CHECKED** and **SMS** is **UNCHECKED** | Yes on Email. No on SMS |
| Temporary password | Leave it blank | No |
| Phone number | Leave it blank | No |
| Mark phone number as verified? | Leave it blank | No |
| Email | a valid email address to receive an invitation email from Media2Cloud | Yes |
| Mark email as verified? | Make sure this is **CHECKED** | Yes |
![Create user](./images/cognito-create-user-details.png)


Click on **Create user**. In a few minutes, you should receive an invitation email as follows.
![Invitation email](./images/welcome-email.png)

----

Back to [README](./README.md)
