# Analysis State Machine

![Analysis state machine](../../../../deployment/tutorials/images/state-machine-analysis-main.png)

Analysis state machine is composed of numbers of states where
* **Prepare analysis** state runs the typed state machine depending on the file type. For instance, it runs both video analysis and audio analysis. In contrast, if the file type is an image, it runs the image analysis process only
* **Start video analysis and wait** state runs the visual analysis process such as extracting labels, objects, celebrities, shot changes event, and so forth
* **Start audio analysis and wait** state runs audio analysis process such as speech to text and natural language processes
* **Start image analysis and wait** state is simlar to video analysis but for image
* **Start document analysis and wait** state extracts text, tables, and forms from a document
* **Collect analysis results** state collects the analysis results
* **Index analysis results** state indexes the analysis results to the Amazon Elasticsearch Service cluster
* **Analysis completed** state stores the results to an Amazon DynamoDB (aiml) table


__


Next to [Video analysis state machine](../video/README.md), [Audio analysis state machine](../audio/README.md), [Image analysis state machine](../image/README.md), [Document analysis state machine](../document/README.md) | Back to [README](../../../../README.md)

