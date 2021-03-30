# Webapp Component

The web application is written in ES6 and uses JQuery and Boostrap libraries.

___

# Security

When you build systems on AWS infrastructure, security responsibilities are shared between you and AWS. This shared model can reduce your operational burden as AWS operates, manages, and controls the components from the host operating system and virtualization layer down to the physical security of the facilities in which the services operate. For more information about security on AWS, visit the [AWS Security Center](https://aws.amazon.com/security).

## Subresource Integrity (SRI)
Web application assets are secured using Subresource Integrity (SRI). Input/output encoding are performed to prevent Cross Site Scripting (XSS) attack.

Sign-in flow uses [Amazon Cognito](https://aws.amazon.com/cognito/) service to authenticate user.

HTTPS requests requires [AWS Signature V4](https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html).

___

# Setting up Development Environment

This section covers on how you can configure the development environment locally for the web application component.

## Prerequisite

### NGINX

For MAC user, you can use [HomeBrew](https://www.sylvaindurand.org/setting-up-a-nginx-web-server-on-macos/) to install.

For Windows user, follow the instruction [here](http://nginx.org/en/docs/windows.html).


### NODEJS

While the frontend web applicaiton is written in JQuery, the backend (lambda function) is written in NodeJS v10.x. In order to build the solution locally, you would need to install NodeJS 10.x or above on your system.

For MAC user, download and install from [nodejs.org](https://nodejs.org/en/download/). Alternatively, you can also use Homebrew.

For Linux or Amazon EC2 user, follow [Tutorial: Setting Up Node.js on an Amazon EC2 Instance](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-up-node-on-ec2-instance.html)

For Windows 10 user, make sure to install [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/install-win10) before installing NodeJS. The build and deploy scripts are written in Bash script.

__

## Step 1: Create a Media2Cloud CloudFormation stack

Although we are running the webapp locally, we still communicate to the backend engine of Media2Cloud instance. Create a Media2Cloud instance with the CloudFormation template as usual.

__

## Step 2: Clone the source code and build the solution

Follow the step described in [README](../../README.md).

```bash
git clone git@github.com:awslabs/media2cloud.git

cd ./media2cloud/deployment

bash build-s3-dist.sh --bucket YOUR_BUCKET --single-region

```
__

## Step 3: Add CORS rules to Amazon S3 Buckets to allow localhost

When you create the CFN stack, the CFN template configures the bucket CORS policy to only allow the Amazon CloudFront distribution the stack creates. Therefore, to run web application locally (localhost), we will need to modify the CORS rules to allow it.

* Find the **ingest** bucket name
  * Log in to AWS CloudFormation Console, click the Media2Cloud stack you created, and click on **Outputs** tab
  * Search for **Bucket**. You should see **IngestBucket**, **ProxyBucket**, and **WebBucket**. These are the buckets created by the stack.
* Go to AWS S3 Console, click on the **ingest** bucket.
* Click on **Permissions** and select **CORS configuration**. You should see a rule as follows:

```xml

<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
<CORSRule>
    <AllowedOrigin>https://<distribution-id>.cloudfront.net</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
    <ExposeHeader>Content-Length</ExposeHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>x-amz-meta-uuid</ExposeHeader>
    <ExposeHeader>x-amz-meta-md5</ExposeHeader>
    <AllowedHeader>*</AllowedHeader>
</CORSRule>
</CORSConfiguration>

```

* Now, append an additional \<CORSRule\> and save the new rule

```xml
<CORSRule>
    <AllowedOrigin>http://localhost</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
    <ExposeHeader>Content-Length</ExposeHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>x-amz-meta-uuid</ExposeHeader>
    <ExposeHeader>x-amz-meta-md5</ExposeHeader>
    <AllowedHeader>*</AllowedHeader>
</CORSRule>

```

* Repeat the same steps for the **proxy** bucket.

__

## Step 4: Download solution-manifest.js

**solution-manifest.js** contains information such as ApiEndpoint, Ingest/Proxy Buckets, IoT pub/sub topic name that is specific to the Media2Cloud instance created by CloudFormation stack. It is auto-generated during the stack creation and is stored to your **web** bucket. The webapp requires it to communicate with the backend resources.

Download the **solution-manifest.js** from web bucket and copy it to your local **media2cloud/source/webapp** folder. _(You can find the Web bucket name from the CloudFormations stack,  Outputs tab, **WebBucket**.)_

```bash
cd ./media2cloud/source/webapp

aws s3 cp s3://<WEB_BUCKET>/solution-manifest.js .

```

__

## Step 5: Modify nginx.conf

The only configuration you would need to modify is the **location.root** in the nginx.conf file. Change the **root** to map to your local **media2cloud/source/webapp** source code folder. See the code snippet below.

```nginx
http {
  ...
  server {
    # listen to PORT 80
    listen 80;

    server_name localhost;

    error_log   /usr/local/var/log/nginx/error_debug.log debug;

    location / {
      # Make sure to set your root directory to /.../media2cloud/source/webapp
      root   /Users/<username>/github/media2cloud/source/webapp;
      index  index.html;
    }
  }
}

```

Save the change and reload or restart nginx.
If you are running the local server on PORT 80, you would likely need to use **sudo**.

```bash

sudo nginx -s reload

# or restart
sudo nginx -s quit && sudo nginx

```

__

## Done

Once nginx started, you should be able to open http://localhost on Chrome or Firefox browser.


___

Back to [README](../../README.md)

