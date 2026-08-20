import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, isAbortError } from "../lib/api";

export type ApiState<Data> =
	| { status: "idle"; data: undefined; error: undefined }
	| { status: "loading"; data: undefined; error: undefined }
	| { status: "success"; data: Data; error: undefined }
	| { status: "empty"; data: Data; error: undefined }
	| { status: "error"; data: undefined; error: ApiError }
	| { status: "offline"; data: undefined; error: ApiError };

export type UseApiOptions<Data> = {
	enabled?: boolean;
	dependencies?: readonly unknown[];
	isEmpty?: (data: Data) => boolean;
};

export type UseApiResult<Data> = {
	state: ApiState<Data>;
	retry: () => void;
};

type ActiveRequest = {
	id: number;
	controller: AbortController;
};

const defaultIsEmpty = (value: unknown): boolean => {
	if (Array.isArray(value)) return value.length === 0;
	if (typeof value !== "object" || value === null) return false;

	const record = value as Record<string, unknown>;
	if (Array.isArray(record.items)) return record.items.length === 0;
	if ("data" in record) return defaultIsEmpty(record.data);
	return false;
};

const isOffline = () =>
	typeof navigator !== "undefined" && navigator.onLine === false;

const normalizedError = (error: unknown): ApiError =>
	error instanceof ApiError
		? error
		: new ApiError({
				status: 0,
				code: "NETWORK_ERROR",
				message: "Unable to reach the server.",
			});

/**
 * Runs an abort-aware API request and exposes a race-free, discriminated state.
 * Callers should memoize `request` or include its changing inputs in `dependencies`.
 */
export function useApi<Data>(
	request: (signal: AbortSignal) => Promise<Data>,
	{
		enabled = true,
		dependencies = [],
		isEmpty = defaultIsEmpty,
	}: UseApiOptions<Data> = {},
): UseApiResult<Data> {
	const [state, setState] = useState<ApiState<Data>>({
		status: "idle",
		data: undefined,
		error: undefined,
	});
	const requestIdRef = useRef(0);
	const activeRequestRef = useRef<ActiveRequest>();

	const cancelActiveRequest = useCallback(() => {
		activeRequestRef.current?.controller.abort();
		activeRequestRef.current = undefined;
	}, []);

	const runRequest = useCallback(() => {
		const active = {
			id: ++requestIdRef.current,
			controller: new AbortController(),
		};
		activeRequestRef.current?.controller.abort();
		activeRequestRef.current = active;
		setState({ status: "loading", data: undefined, error: undefined });

		void Promise.resolve()
			.then(() => request(active.controller.signal))
			.then((data) => {
				if (activeRequestRef.current?.id !== active.id) return;
				setState({
					status: isEmpty(data) ? "empty" : "success",
					data,
					error: undefined,
				});
			})
			.catch((error: unknown) => {
				if (isAbortError(error) || activeRequestRef.current?.id !== active.id) {
					return;
				}
				const apiError = normalizedError(error);
				setState({
					status:
						apiError.code === "NETWORK_ERROR" && isOffline()
							? "offline"
							: "error",
					data: undefined,
					error: apiError,
				});
			});
	}, [isEmpty, request]);

	const retry = useCallback(() => {
		if (enabled) runRequest();
	}, [enabled, runRequest]);

	useEffect(() => {
		if (!enabled) {
			requestIdRef.current += 1;
			cancelActiveRequest();
			setState({ status: "idle", data: undefined, error: undefined });
			return;
		}

		runRequest();
		return cancelActiveRequest;
	}, [cancelActiveRequest, enabled, runRequest, ...dependencies]);

	return { state, retry };
}
