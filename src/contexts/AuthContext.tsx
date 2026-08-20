import {
	type PropsWithChildren,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import {
	ApiError,
	type ApiRequestBody,
	apiRequest,
	clearCsrfToken,
	isAbortError,
	subscribeToAuthInvalidation,
} from "../lib/api";
import type { SelfUser } from "../lib/contracts";

export type AuthState =
	| { status: "loading"; user: null }
	| { status: "anonymous"; user: null }
	| { status: "authenticated"; user: SelfUser; restoreError?: ApiError }
	| { status: "error"; user: null; error: ApiError }
	| { status: "offline"; user: null; error: ApiError };

type PendingRequest = {
	id: number;
	controller: AbortController;
};

const initialState: AuthState = { status: "loading", user: null };

const isOffline = () =>
	typeof navigator !== "undefined" && navigator.onLine === false;

const normalizedError = (error: unknown): ApiError =>
	error instanceof ApiError
		? error
		: new ApiError({
				status: 0,
				code: "NETWORK_ERROR",
				message: "Unable to restore your session.",
			});

export type AuthContextValue = {
	state: AuthState;
	user: SelfUser | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	restoreSession: () => Promise<SelfUser | null | undefined>;
	retrySession: () => Promise<SelfUser | null | undefined>;
	register: (
		input: ApiRequestBody<"register">,
	) => Promise<SelfUser | undefined>;
	login: (input: ApiRequestBody<"login">) => Promise<SelfUser | undefined>;
	loginDemo: () => Promise<SelfUser | undefined>;
	logout: () => Promise<void>;
	updateProfile: (
		input: ApiRequestBody<"mePatch">,
	) => Promise<SelfUser | undefined>;
	changePassword: (input: ApiRequestBody<"mePassword">) => Promise<void>;
	changeNeighborhood: (neighborhoodId: string) => Promise<SelfUser | undefined>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
	const [state, setState] = useState<AuthState>(initialState);
	const stateRef = useRef<AuthState>(initialState);
	const mountedRef = useRef(false);
	const requestIdRef = useRef(0);
	const pendingRequestRef = useRef<PendingRequest>();

	const setAuthState = useCallback((next: AuthState) => {
		stateRef.current = next;
		setState(next);
	}, []);

	const startRequest = useCallback((): PendingRequest => {
		pendingRequestRef.current?.controller.abort();
		const pending = {
			id: ++requestIdRef.current,
			controller: new AbortController(),
		};
		pendingRequestRef.current = pending;
		return pending;
	}, []);

	const isCurrentRequest = useCallback(
		(pending: PendingRequest) =>
			mountedRef.current && pendingRequestRef.current?.id === pending.id,
		[],
	);

	const finishRequest = useCallback((pending: PendingRequest) => {
		if (pendingRequestRef.current?.id === pending.id) {
			pendingRequestRef.current = undefined;
		}
	}, []);

	const commitAnonymous = useCallback(
		(pending: PendingRequest) => {
			if (!isCurrentRequest(pending)) return false;
			clearCsrfToken();
			setAuthState({ status: "anonymous", user: null });
			return true;
		},
		[isCurrentRequest, setAuthState],
	);

	const commitAuthenticated = useCallback(
		(pending: PendingRequest, user: SelfUser) => {
			if (!isCurrentRequest(pending)) return false;
			setAuthState({ status: "authenticated", user });
			return true;
		},
		[isCurrentRequest, setAuthState],
	);

	const invalidateAuthenticatedSession = useCallback(() => {
		pendingRequestRef.current?.controller.abort();
		pendingRequestRef.current = undefined;
		requestIdRef.current += 1;
		clearCsrfToken();

		if (!mountedRef.current || stateRef.current.status === "anonymous") return;
		setAuthState({ status: "anonymous", user: null });
	}, [setAuthState]);

	const commitRestoreFailure = useCallback(
		(pending: PendingRequest, error: unknown) => {
			if (!isCurrentRequest(pending)) return false;
			const apiError = normalizedError(error);
			const current = stateRef.current;
			if (current.status === "authenticated") {
				setAuthState({ ...current, restoreError: apiError });
				return true;
			}
			setAuthState({
				status:
					apiError.code === "NETWORK_ERROR" && isOffline()
						? "offline"
						: "error",
				user: null,
				error: apiError,
			});
			return true;
		},
		[isCurrentRequest, setAuthState],
	);

	const restoreSession = useCallback(async (): Promise<
		SelfUser | null | undefined
	> => {
		const pending = startRequest();
		const priorState = stateRef.current;
		if (priorState.status === "authenticated") {
			if (priorState.restoreError) {
				setAuthState({ ...priorState, restoreError: undefined });
			}
		} else if (isCurrentRequest(pending)) {
			setAuthState({ status: "loading", user: null });
		}

		try {
			const session = await apiRequest("session", {
				signal: pending.controller.signal,
			});
			const user = session.data.user;
			if (!user) {
				return commitAnonymous(pending) ? null : undefined;
			}
			return commitAuthenticated(pending, user) ? user : undefined;
		} catch (error) {
			if (isAbortError(error)) return undefined;
			commitRestoreFailure(pending, error);
			return undefined;
		} finally {
			finishRequest(pending);
		}
	}, [
		commitAnonymous,
		commitAuthenticated,
		commitRestoreFailure,
		finishRequest,
		isCurrentRequest,
		setAuthState,
		startRequest,
	]);

	const retrySession = useCallback(() => restoreSession(), [restoreSession]);

	const register = useCallback(
		async (
			input: ApiRequestBody<"register">,
		): Promise<SelfUser | undefined> => {
			const pending = startRequest();
			try {
				const session = await apiRequest("register", {
					body: input,
					signal: pending.controller.signal,
				});
				return commitAuthenticated(pending, session.data)
					? session.data
					: undefined;
			} catch (error) {
				if (isAbortError(error)) return undefined;
				if (stateRef.current.status === "loading") void restoreSession();
				throw error;
			} finally {
				finishRequest(pending);
			}
		},
		[commitAuthenticated, finishRequest, restoreSession, startRequest],
	);

	const login = useCallback(
		async (input: ApiRequestBody<"login">): Promise<SelfUser | undefined> => {
			const pending = startRequest();
			try {
				const session = await apiRequest("login", {
					body: input,
					signal: pending.controller.signal,
				});
				return commitAuthenticated(pending, session.data)
					? session.data
					: undefined;
			} catch (error) {
				if (isAbortError(error)) return undefined;
				if (stateRef.current.status === "loading") void restoreSession();
				throw error;
			} finally {
				finishRequest(pending);
			}
		},
		[commitAuthenticated, finishRequest, restoreSession, startRequest],
	);

	const loginDemo = useCallback(async (): Promise<SelfUser | undefined> => {
		const pending = startRequest();
		try {
			const session = await apiRequest("demoAuth", {
				signal: pending.controller.signal,
			});
			return commitAuthenticated(pending, session.data)
				? session.data
				: undefined;
		} catch (error) {
			if (isAbortError(error)) return undefined;
			if (stateRef.current.status === "loading") void restoreSession();
			throw error;
		} finally {
			finishRequest(pending);
		}
	}, [commitAuthenticated, finishRequest, restoreSession, startRequest]);

	const logout = useCallback(async (): Promise<void> => {
		const pending = startRequest();
		try {
			await apiRequest("logout", { signal: pending.controller.signal });
			commitAnonymous(pending);
		} catch (error) {
			if (isAbortError(error)) return;
			throw error;
		} finally {
			finishRequest(pending);
		}
	}, [commitAnonymous, finishRequest, startRequest]);

	const updateProfile = useCallback(
		async (input: ApiRequestBody<"mePatch">): Promise<SelfUser | undefined> => {
			const pending = startRequest();
			try {
				const result = await apiRequest("mePatch", {
					body: input,
					signal: pending.controller.signal,
				});
				return commitAuthenticated(pending, result.data)
					? result.data
					: undefined;
			} catch (error) {
				if (isAbortError(error)) return undefined;
				throw error;
			} finally {
				finishRequest(pending);
			}
		},
		[commitAuthenticated, finishRequest, startRequest],
	);

	const changePassword = useCallback(
		async (input: ApiRequestBody<"mePassword">): Promise<void> => {
			const pending = startRequest();
			try {
				await apiRequest("mePassword", {
					body: input,
					signal: pending.controller.signal,
				});
				commitAnonymous(pending);
			} catch (error) {
				if (isAbortError(error)) return;
				throw error;
			} finally {
				finishRequest(pending);
			}
		},
		[commitAnonymous, finishRequest, startRequest],
	);

	const changeNeighborhood = useCallback(
		(neighborhoodId: string) => updateProfile({ neighborhoodId }),
		[updateProfile],
	);

	useEffect(() => {
		mountedRef.current = true;
		const unsubscribe = subscribeToAuthInvalidation(
			invalidateAuthenticatedSession,
		);
		void restoreSession();
		return () => {
			unsubscribe();
			mountedRef.current = false;
			pendingRequestRef.current?.controller.abort();
			pendingRequestRef.current = undefined;
		};
	}, [invalidateAuthenticatedSession, restoreSession]);

	const value = useMemo<AuthContextValue>(
		() => ({
			state,
			user: state.user,
			isLoading: state.status === "loading",
			isAuthenticated: state.status === "authenticated",
			restoreSession,
			retrySession,
			register,
			login,
			loginDemo,
			logout,
			updateProfile,
			changePassword,
			changeNeighborhood,
		}),
		[
			changeNeighborhood,
			changePassword,
			login,
			loginDemo,
			logout,
			register,
			restoreSession,
			retrySession,
			state,
			updateProfile,
		],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const value = useContext(AuthContext);
	if (!value) {
		throw new Error("useAuth must be used within an AuthProvider.");
	}
	return value;
}
