const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const multer = require('multer');
const fs = require('fs');
const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { CognitiveServicesCredentials } = require('@azure/ms-rest-azure-js');
require('dotenv').config();

const app = express();
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// Azure credentials
const subscriptionKey = process.env.AZURE_API_KEY;
const endpoint = process.env.AZURE_ENDPOINT;

if (!subscriptionKey || !endpoint) {
    console.error("Missing Azure API Key or Endpoint in .env");
    process.exit(1);
}

const visionProcessor = new ComputerVisionClient(
    new CognitiveServicesCredentials(subscriptionKey),
    endpoint
);

// Middleware to validate imageUrl
const checkImageUrl = (req, res, next) => {
    const { imageUrl } = req.body;
    if (!imageUrl) {
        return res.status(400).json({ error: 'Image URL is required' });
    }
    try {
        new URL(imageUrl);
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid URL format' });
    }
};

// Error handler
const processError = (err, res) => {
    console.error('Error:', err);
    res.status(500).json({
        error: err.message || 'An error occurred during image analysis'
    });
};

// Swagger setup
const apiDocConfig = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Azure AI Image Analysis',
            version: '1.0.0',
            description: 'Comprehensive API for Computer Vision Analysis'
        },
        servers: [
            {
                url: process.env.API_BASE_URL || 'http://161.35.141.107:5000',
                description: 'Development server'
            }
        ]
    },
    apis: ['./app.js']
};

const apiDocs = swaggerJsdoc(apiDocConfig);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(apiDocs));

/**
 * @swagger
 * /api/vision/analyze:
 *   post:
 *     summary: Analyze an image via URL
 *     tags: [Vision Analysis]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageUrl
 *             properties:
 *               imageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Analysis success
 */
app.post("/api/vision/analyze", checkImageUrl, async (req, res) => {
    try {
        const analysis = await visionProcessor.analyzeImage(req.body.imageUrl, {
            visualFeatures: [
                "ImageType", "Faces", "Adult", "Categories",
                "Color", "Tags", "Description", "Objects", "Brands"
            ],
            details: ["Landmarks"]
        });
        res.json(analysis);
    } catch (err) {
        processError(err, res);
    }
});

/**
 * @swagger
 * /api/vision/analyze-upload:
 *   post:
 *     summary: Analyze an uploaded image
 *     tags: [Vision Analysis]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Successful analysis
 */
app.post('/api/vision/analyze-upload', upload.single('image'), async (req, res) => {
    try {
        const imgPath = req.file.path;
        const stream = fs.createReadStream(imgPath);
        const analysis = await visionProcessor.analyzeImageInStream(stream, {
            visualFeatures: [
                "ImageType", "Faces", "Adult", "Categories",
                "Color", "Tags", "Description", "Objects", "Brands"
            ],
            details: ["Landmarks"]
        });
        fs.unlinkSync(imgPath);
        res.json(analysis);
    } catch (err) {
        processError(err, res);
    }
});

// More endpoints (tags, objects, describe, text, faces, colors)
app.post("/api/vision/tags", checkImageUrl, async (req, res) => {
    try {
        const analysis = await visionProcessor.analyzeImage(req.body.imageUrl, {
            visualFeatures: ['Tags']
        });
        res.json(analysis.tags);
    } catch (err) {
        processError(err, res);
    }
});

app.post("/api/vision/objects", checkImageUrl, async (req, res) => {
    try {
        const analysis = await visionProcessor.detectObjects(req.body.imageUrl);
        res.json(analysis);
    } catch (err) {
        processError(err, res);
    }
});

app.post("/api/vision/describe", checkImageUrl, async (req, res) => {
    try {
        const analysis = await visionProcessor.describeImage(req.body.imageUrl);
        res.json(analysis);
    } catch (err) {
        processError(err, res);
    }
});

app.post("/api/vision/text", checkImageUrl, async (req, res) => {
    try {
        const analysis = await visionProcessor.recognizePrintedText(false, req.body.imageUrl);
        res.json(analysis);
    } catch (err) {
        processError(err, res);
    }
});

app.post("/api/vision/faces", checkImageUrl, async (req, res) => {
    try {
        const analysis = await visionProcessor.analyzeImage(req.body.imageUrl, {
            visualFeatures: ['Faces']
        });
        res.json(analysis.faces);
    } catch (err) {
        processError(err, res);
    }
});

app.post("/api/vision/colors", checkImageUrl, async (req, res) => {
    try {
        const analysis = await visionProcessor.analyzeImage(req.body.imageUrl, {
            visualFeatures: ['Color']
        });
        res.json(analysis.color);
    } catch (err) {
        processError(err, res);
    }
});

// Root
const SERVER_PORT = process.env.PORT || 5000;
app.get('/', (req, res) => {
    res.json({
        message: "Welcome to Azure AI Image Analysis API",
        documentation: `${process.env.API_BASE_URL || 'http://161.35.141.107:5000'}/api-docs`,
        endpoints: {
            analyze_url: "/api/vision/analyze",
            analyze_upload: "/api/vision/analyze-upload",
            tags: "/api/vision/tags",
            objects: "/api/vision/objects",
            describe: "/api/vision/describe",
            text: "/api/vision/text",
            faces: "/api/vision/faces",
            colors: "/api/vision/colors"
        }
    });
});

app.listen(SERVER_PORT, () => {
    console.log(`✅ Server running at http://161.35.141.107:5000`);
    console.log(`📘 Docs: http://161.35.141.107:5000/api-docs`);
});

/**
 * @swagger
 * /api/status:
 *   get:
 *     summary: Check server status
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: Server is running
 */
app.get("/api/status", (req, res) => {
    res.json({
        status: "✅ Server is up and running!",
        time: new Date().toISOString()
    });
});

/**
 * @swagger
 * /api/vision/describe:
 *   put:
 *     summary: Mock update of image description
 *     tags: [Vision Analysis]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageUrl
 *               - newLabel
 *             properties:
 *               imageUrl:
 *                 type: string
 *               newLabel:
 *                 type: string
 *     responses:
 *       200:
 *         description: Description updated
 *       400:
 *         description: Bad request
 */
app.put("/api/vision/describe", (req, res) => {
    const { imageUrl, newLabel } = req.body;

    if (!imageUrl || !newLabel) {
        return res.status(400).json({ error: "Both imageUrl and newLabel are required." });
    }

    res.json({
        message: "📝 Description label updated (mock).",
        imageUrl,
        updatedLabel: newLabel
    });
});
/**
 * @swagger
 * /api/vision/label:
 *   patch:
 *     summary: Partially update image label (mock)
 *     tags: [Vision Analysis]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageUrl
 *               - labelPatch
 *             properties:
 *               imageUrl:
 *                 type: string
 *               labelPatch:
 *                 type: string
 *     responses:
 *       200:
 *         description: Partial label update success
 *       400:
 *         description: Missing fields
 */
app.patch("/api/vision/label", (req, res) => {
    const { imageUrl, labelPatch } = req.body;

    if (!imageUrl || !labelPatch) {
        return res.status(400).json({ error: "imageUrl and labelPatch are required." });
    }

    res.json({
        message: "🔧 Label patched successfully (mock).",
        imageUrl,
        patchedLabel: labelPatch
    });
});
