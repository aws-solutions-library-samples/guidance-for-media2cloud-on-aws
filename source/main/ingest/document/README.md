# Document Ingest State Machine

Document Ingest state machine uses third party tools, [Mozillia PDF.JS](https://github.com/mozilla/pdf.js) and [Node Canvas](https://github.com/Automattic/node-canvas) to extract PDF metadata, convert pages into images.

![Document Ingest state machine](../../../../deployment/tutorials/images/state-machine-ingest-document.png)

__

* **Run PDFInfo and extract pages** state extracts PDF metadata, converts pages into images, and stores the results to Amazon S3 proxy bucket
* **More pages?** state is a Choice page to ensure all pages are processed
* **PDFInfo completed** state is an end state

__

Back to [Ingest State Machine](../main/README.md) | Back to [README](../../../../README.md)
