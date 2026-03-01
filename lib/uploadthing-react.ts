"use client";
// Client-side helpers — must stay in its own "use client" module
import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "./uploadthing";

export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
