import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

const PredictButton = ({ title = 'Predict', onPress, className, textClassName, disabled }) => {
	return (
		<TouchableOpacity
			className={`w-full rounded-full bg-aquaprimary py-3 items-center justify-center ${
				disabled ? 'bg-aquaaccent/70 opacity-70' : ''
			} ${className || ''}`}
			onPress={onPress}
			activeOpacity={0.8}
			disabled={disabled}
		>
			<Text
				className={`text-[15px] font-semibold text-slate-950 ${
					textClassName || ''
				}`}
			>
				{title}
			</Text>
		</TouchableOpacity>
	);
};

export default PredictButton;
