## Media2Cloud mini workshop

This tutorial walks you through to create Media2Cloud with AWS CloudFormation service. We will then show you a few techniques to automate Media2Cloud processes such as ingesting contents and analyzing contents with various AWS services.

### Prerequisite
* Download and install [Mozilla Firefox](https://www.mozilla.org/en-US/firefox/new/) or [Google Chrome](https://www.google.com/chrome/) browser. We will use it to access the Media2Cloud web portal.
* Download and install [Postman](https://www.getpostman.com/apps). We will use it for Step 2.
* Optionally if you need some sample files to test, download it [here](http://d2yqlwoly7fl0b.cloudfront.net/tutorials/samples/sample-files.zip)


### Mini workshop rundown
We will start off with creating your own Media2Cloud instance. Then, we will use Media2Cloud RESTful api to drive the ingest and analysis processes; use Amazon S3 event to autostart ingest process when you upload a file. At last, we will use Amazon SNS notification to autostart the analysis process when the file has been ingested. Appendix A shows you how you can add and manage Media2Cloud users with Amazon Cognito User Pool service.


* [Step 1: creating your own Media2Cloud instance](./1-create-stack.md) on your AWS account.
* [Step 2: using Media2Cloud RESTful api](./2-restful-api.md) to drive the ingest and analysis processes
* [Step 3: using Amazon S3 event](./3-s3-event-trigger.md) to autostart ingest process
* [Step 4: using Amazon SNS notification](./4-sns-notification.md) to autostart analysis process
* [Appendix A: using Amazon Cognito User Pool service](./appendix-a-add-cognito-user.md) to add and manage Media2Cloud user(s)

----

Click [Next](./1-create-stack.md) to start creating your own instance.
