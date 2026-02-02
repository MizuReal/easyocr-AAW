import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';

const riskBadgeStyles = {
	safe: {
		container: 'border-emerald-500/40 bg-emerald-500/10',
		text: 'text-emerald-100',
	},
	borderline: {
		container: 'border-amber-400/40 bg-amber-400/10',
		text: 'text-amber-50',
	},
	watch: {
		container: 'border-orange-400/40 bg-orange-500/10',
		text: 'text-orange-100',
	},
	unsafe: {
		container: 'border-rose-500/60 bg-rose-500/10',
		text: 'text-rose-100',
	},
	default: {
		container: 'border-slate-700 bg-slate-800/60',
		text: 'text-slate-200',
	},
};

const parameterSeverityStyles = {
	ok: {
		container: 'border-emerald-500/30 bg-emerald-500/5',
		badge: 'text-emerald-200',
	},
	warning: {
		container: 'border-amber-400/40 bg-amber-500/10',
		badge: 'text-amber-200',
	},
	critical: {
		container: 'border-rose-500/60 bg-rose-500/10',
		badge: 'text-rose-200',
	},
	missing: {
		container: 'border-slate-800 bg-slate-900/60',
		badge: 'text-slate-400',
	},
	default: {
		container: 'border-slate-800 bg-slate-900/60',
		badge: 'text-slate-400',
	},
};

const formatNumericValue = (value) => {
	if (value === undefined || value === null) {
		return '--';
	}
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return '--';
	}
	return parsed.toFixed(2);
};

const formatRecommendedRange = (range) => {
	if (!Array.isArray(range) || range.length !== 2) {
		return 'range unavailable';
	}
	const [low, high] = range.map((value) => Number(value));
	if (!Number.isFinite(low) || !Number.isFinite(high)) {
		return 'range unavailable';
	}
	return `${low.toFixed(2)} - ${high.toFixed(2)}`;
};

const parameterGroupMeta = {
	core: {
		title: 'Core parameters',
		fields: ['pH', 'hardness', 'solids', 'conductivity'],
	},
	chemical: {
		title: 'Chemical compounds',
		fields: ['chloramines', 'sulfate', 'organic_carbon', 'trihalomethanes'],
	},
	physical: {
		title: 'Physical & disinfectant',
		fields: ['turbidity', 'free_chlorine_residual'],
	},
};

const normalizeFieldKey = (field = '') => field.toLowerCase();

const WaterResultScreen = ({ visible, onClose, result }) => {
	if (!result) {
		return null;
	}

	const riskStyle = riskBadgeStyles[result.riskLevel] || riskBadgeStyles.default;
	const timestampLabel = result.timestamp
		? new Date(result.timestamp).toLocaleString()
		: 'timestamp pending';
	const missingFeatures = result.missingFeatures || [];
	const groupedChecks = Object.values(parameterGroupMeta).map((group) => ({
		title: group.title,
		checks: (result.checks || []).filter((check) =>
			group.fields.some((field) => normalizeFieldKey(field) === normalizeFieldKey(check.field))
		),
	}));

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent={false}
			presentationStyle="fullScreen"
			onRequestClose={onClose}
		>
			<SafeAreaView className="flex-1 bg-slate-950">
				<View className="flex-row items-center justify-between border-b border-slate-900 px-5 py-4">
						<Text className="text-[12px] font-semibold uppercase tracking-[4px] text-slate-400">Potability verdict</Text>
						<TouchableOpacity
							accessibilityRole="button"
							onPress={onClose}
							className="rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5"
							activeOpacity={0.85}
						>
							<Text className="text-[12px] font-semibold text-slate-100">Close</Text>
						</TouchableOpacity>
					</View>

					<ScrollView
						className="flex-1 px-5"
						contentContainerStyle={{ paddingBottom: 32 }}
						showsVerticalScrollIndicator={false}
					>
						<View className="mt-5 rounded-[30px] border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5">
							<View className="flex-row items-center justify-between">
								<Text className="text-[28px] font-semibold text-sky-50">
									{result.isPotable ? 'Potable' : 'Not potable'}
								</Text>
								<View className={`rounded-full px-3 py-1 ${riskStyle.container}`}>
									<Text className={`text-[11px] font-semibold uppercase ${riskStyle.text}`}>
										{result.riskLevel || 'pending'}
									</Text>
								</View>
							</View>
							<Text className="mt-2 text-[13px] text-slate-300">{result.message}</Text>
							<View className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
								<Text className="text-[12px] font-semibold text-slate-100">
									Model confidence: {(result.probability * 100).toFixed(1)}%
								</Text>
								<Text className="text-[11px] text-slate-500">
									{timestampLabel} · {result.modelVersion}
								</Text>
								<Text className="text-[11px] text-slate-500">
									Source: {result?.meta?.source || 'n/a'} · Color: {result?.meta?.color || 'n/a'}
								</Text>
								{result.sampleId ? (
									<Text className="text-[11px] text-slate-500">Sample #{result.sampleId.slice(0, 8)}</Text>
								) : null}
							</View>
							<Text className={`mt-3 text-[12px] ${result.saved ? 'text-emerald-300' : 'text-slate-400'}`}>
								{result.saved
									? 'Sample synced to Supabase.'
									: 'Cloud sync unavailable. Check Supabase credentials.'}
							</Text>
						</View>

						{groupedChecks.map((group) => (
							<View key={group.title} className="mt-6 rounded-[28px] border border-slate-900 bg-slate-950/70 p-5">
								<Text className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
									{group.title}
								</Text>
								{group.checks.length ? (
									<View className="mt-3 gap-3">
										{group.checks.map((check) => {
											const severity = parameterSeverityStyles[check.status] || parameterSeverityStyles.default;
											return (
												<View
													key={check.field}
													className={`rounded-2xl border px-4 py-3 ${severity.container}`}
												>
													<View className="flex-row items-center justify-between">
														<Text className="text-[13px] font-semibold text-slate-50">{check.label}</Text>
														<Text className={`text-[11px] font-semibold uppercase ${severity.badge}`}>
															{(check.status || 'pending').toUpperCase()}
														</Text>
													</View>
													<Text className="mt-1 text-[12px] text-slate-300">
														Observed {formatNumericValue(check.value)} · Recommended {formatRecommendedRange(check.recommendedRange)}
													</Text>
													<Text className="mt-1 text-[12px] text-slate-400">{check.detail}</Text>
													{typeof check.zScore === 'number' && Number.isFinite(check.zScore) ? (
														<Text className="mt-0.5 text-[11px] text-slate-500">Z-score {check.zScore.toFixed(2)}</Text>
													) : null}
												</View>
											);
										})}
									</View>
								) : (
									<Text className="mt-3 text-[12px] text-slate-500">No readings in this section.</Text>
								)}
							</View>
						))}

						{missingFeatures.length ? (
							<View className="mt-6 rounded-[24px] border border-amber-500/30 bg-amber-500/5 p-4">
								<Text className="text-[12px] font-semibold uppercase tracking-wide text-amber-200">
									Missing inputs
								</Text>
								<Text className="mt-2 text-[12px] text-amber-100/80">
									Provide these metrics next capture for tighter confidence intervals:
								</Text>
								<View className="mt-3 flex-row flex-wrap gap-2">
									{missingFeatures.map((field) => (
										<View key={field} className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1">
											<Text className="text-[11px] font-semibold uppercase tracking-wide text-amber-100">
												{field}
											</Text>
										</View>
									))}
								</View>
							</View>
						) : null}
					</ScrollView>
				</SafeAreaView>
		</Modal>
	);
};

export default WaterResultScreen;
