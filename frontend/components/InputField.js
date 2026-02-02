import React from 'react';
import { View, Text, TextInput } from 'react-native';

const InputField = ({ label, className, ...textInputProps }) => {
	return (
		<View className="w-full">
			{label ? (
				<Text className="mb-1.5 text-[13px] font-medium text-sky-100">
					{label}
				</Text>
			) : null}
			<TextInput
				className={`w-full rounded-xl border border-blue-600/70 bg-aquadark px-3.5 py-2.5 text-[14px] text-slate-100 ${className || ''}`}
				placeholderTextColor="#64748b"
				{...textInputProps}
			/>
		</View>
	);
};

export default InputField;
