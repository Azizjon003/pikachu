# Asynchronous Slide Generation Task System

This document explains how the asynchronous task system for slide generation works. This system was implemented to prevent server timeouts during long-running presentation generation processes.

## Overview

Instead of waiting for the entire slide generation process to complete in a single request, the new system works as follows:

1.  An initial request is sent to **start** the generation process.
2.  The server immediately accepts the request, creates a background task, and returns a unique **Task ID**.
3.  The client can then periodically use this Task ID to **check the status** of the generation task.
4.  Once the task is complete, the status endpoint will return the final result, including the path to the generated presentation file.

---

## API Endpoints

### 1. Start Slide Generation

This endpoint initiates a new slide generation task.

- **URL**: `/api/slide/generate`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "template": "template-name.sxema.json",
    "language": "Uzbek",
    "page": 5,
    "topic": "Artificial Intelligence",
    "author": "John Doe"
  }
  ```
- **Success Response (202 Accepted)**:
  The server acknowledges the request and provides a `taskId` to track the process.
  ```json
  {
    "success": true,
    "message": "Slide generation started",
    "taskId": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
  }
  ```

### 2. Check Generation Status

This endpoint is used to poll for the status of an ongoing generation task.

- **URL**: `/api/slide/generate/status/:taskId`
- **Method**: `GET`
- **URL Parameters**:

  - `taskId` (string, required): The ID of the task received from the start endpoint.

- **Response Examples**:

  - **When the task is in progress:**

    ```json
    {
      "success": true,
      "task": {
        "id": "a1b2c3d4e5f6...",
        "status": "processing",
        "progress": 40,
        "result": null,
        "error": null,
        "createdAt": "2025-10-19T10:00:00.000Z",
        "updatedAt": "2025-10-19T10:01:15.000Z"
      }
    }
    ```

  - **When the task is completed successfully:**

    ```json
    {
      "success": true,
      "task": {
        "id": "a1b2c3d4e5f6...",
        "status": "completed",
        "progress": 100,
        "result": {
          "success": true,
          "slidePath": "generated/1678886400000-topic.pptx",
          "slideName": "1678886400000-topic.pptx",
          "message": "Slide generated successfully"
        },
        "error": null
      }
    }
    ```

  - **When the task has failed:**
    ```json
    {
      "success": true,
      "task": {
        "id": "a1b2c3d4e5f6...",
        "status": "failed",
        "progress": 65,
        "result": null,
        "error": "An error message describing what went wrong."
      }
    }
    ```
  - **If the task is not found:** (404 Not Found)
    ```json
    {
      "success": false,
      "message": "Task not found"
    }
    ```

### 3. Synchronous Generation (Legacy)

For testing or backward compatibility, the old synchronous endpoint is still available. This endpoint will hold the connection until the generation is complete.

- **URL**: `/api/slide/generate-sync`
- **Method**: `POST`
- **Body**: Same as the `/api/slide/generate` endpoint.

---

## Recommended Workflow

1.  **Initiate Generation**: Send a `POST` request to `/api/slide/generate` with the required parameters.
2.  **Store Task ID**: Save the `taskId` from the response.
3.  **Poll for Status**: Set up a polling mechanism (e.g., every 2-3 seconds) to send `GET` requests to `/api/slide/generate/status/:taskId`.
4.  **Update UI**: Use the `progress` and `status` fields from the polling response to show the real-time status to the user.
5.  **Handle Completion**:
    - If `status` becomes `"completed"`, stop polling and use the `result` object to provide a download link for the presentation.
    - If `status` becomes `"failed"`, stop polling and display the `error` message to the user.
