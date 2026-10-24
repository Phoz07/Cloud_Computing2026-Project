import { createFileRoute } from "@tanstack/react-router";

// the list itself renders in the _browse layout, which reads `category` (a category slug) from the params
export const Route = createFileRoute("/events/_browse/categories/$category")({});
