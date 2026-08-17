import { useCallback, useState } from "react";

interface CommonControlledStateProps<T> {
	value?: T;
	defaultValue?: T;
}

type UseControlledStateProps<T, Rest extends unknown[] = []> = CommonControlledStateProps<T> & {
	onChange?: (value: T, ...args: Rest) => void;
};

export function useControlledState<T, Rest extends unknown[] = []>(
	props: UseControlledStateProps<T, Rest>,
): readonly [T, (next: T, ...args: Rest) => void] {
	const { value, defaultValue, onChange } = props;

	const [state, setInternalState] = useState<T>(value !== undefined ? value : (defaultValue as T));

	// Adjusting state during render — React's documented pattern for "a prop
	// changed and derived state must follow" — rather than in an effect. The
	// effect version needed a second render pass to catch up, so a controlled
	// consumer rendered one frame with the previous value.
	//
	// Deliberately not rewritten to derive `state` straight from `value`, which
	// would be the tidier shape: these four consumers (color-picker, chip-input,
	// combobox) rely on a local set showing immediately even while controlled,
	// and dropping that would change input behaviour that cannot be verified
	// from a lint run.
	const [lastValue, setLastValue] = useState(value);
	if (value !== undefined && value !== lastValue) {
		setLastValue(value);
		setInternalState(value);
	}

	const setState = useCallback(
		(next: T, ...args: Rest) => {
			setInternalState(next);
			onChange?.(next, ...args);
		},
		[onChange],
	);

	return [state, setState] as const;
}
