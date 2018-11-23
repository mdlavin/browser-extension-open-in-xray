try {
  const attributeToExpressionMap = {
    correlationId: {
      buildFilter: (value) => `annotation.correlationId="${value}"`
    }
  }
  const region = 'us-east-1';
  const timeAttributeName = 'time';

  function buildXRayLink(attributeConfig, attributeValue, time) {
    const hourBefore = new Date(time - 60 * 60 * 1000);
    const hourAfter = new Date(time + 60 * 60 * 1000);
    const query = {
      filter: attributeConfig.buildFilter(attributeValue),
      timeRange: `${hourBefore.toISOString()}~${hourAfter.toISOString()}`
    };

    const params = new URLSearchParams(query);
    return `https://console.aws.amazon.com/xray/home?region=${region}#/traces?${params.toString()}`;
  }

  function hasClassName(classname) {
    return `contains(concat(" ",normalize-space(@class)," ")," ${classname} ")`;
  }

  function attributeContainerExpression(attributeName) {
    return `./*[${hasClassName("obj-container")} and
               ./*[${hasClassName("prop")} and
                 ./*[${hasClassName("key")} and
                 text()="${attributeName}"]
               ]
            ]`;
  }

  function attributeRecordExpression (attributeName) {
    return `//*[${hasClassName("obj")} and
              ${attributeContainerExpression(attributeName)}
              and
              ${attributeContainerExpression(timeAttributeName)}
            ]`;
  }

  function extractResultAttributeValue(container, attributeName) {
    const extractExpression = `
      ${attributeContainerExpression(attributeName)}
      /*[${hasClassName("qval")}]/span/text() `;

    return JSON.parse(
      document.evaluate(
        extractExpression,
        container,
        null,
        XPathResult.STRING_TYPE,
        null
      ).stringValue
    );
  }

  function getAttributeValueNode(container, attributeName) {
    const extractExpression = `
      ${attributeContainerExpression(attributeName)}
      /*[${hasClassName("qval")}]`;

    return document
      .evaluate(extractExpression, container, null, XPathResult.ANY_TYPE, null)
      .iterateNext();
  }

  function addLinksForAttribute(attributeName, attributeConfig) {
    const recordsWithAttribute = document.evaluate(
      attributeRecordExpression(attributeName),
      document,
      null,
      XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
      null
    );

    const records = [];
    let matchingRecord = recordsWithAttribute.iterateNext();
    while (matchingRecord) {
      records.push(matchingRecord);
      matchingRecord = recordsWithAttribute.iterateNext();
    }

    for (const record of records) {
      const attributeValue = extractResultAttributeValue(
        record,
        attributeName
      );
      const time = Date.parse(extractResultAttributeValue(record, timeAttributeName));

      const labelNode = getAttributeValueNode(record, attributeName);

      const existingXRayLinks = labelNode.querySelectorAll(".xray-link");
      for (const oldLink of existingXRayLinks) {
        oldLink.remove();
      }

      const xrayLinkElement = document.createElement("a");
      xrayLinkElement.className = "xray-link";
      xrayLinkElement.href = buildXRayLink(attributeConfig, attributeValue, time);
      xrayLinkElement.appendChild(document.createTextNode("(Open in X-Ray)"));
      labelNode.appendChild(xrayLinkElement);
    }
  }

  function addLinksToDocument () {
    const configEntries = Object.entries(attributeToExpressionMap);
    for (const [attributeName, attributeConfig] of configEntries) {
      addLinksForAttribute(attributeName, attributeConfig);
    }
  }

  addLinksToDocument();

  let pendingLinks;
  const observer = new MutationObserver(function(mutation) {
    if (pendingLinks) {
      clearTimeout(pendingLinks);
      pendingLinks = null;
    }

    pendingLinks = setTimeout(function() {
      pendingLinks = null;
      observer.disconnect();
      try {
        addLinksToDocument();
      } finally {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }, 100);
  });
  observer.observe(document.body, { childList: true, subtree: true });
} catch (e) {
  console.error("Failure in extension", e);
}
