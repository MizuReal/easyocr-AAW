import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, Modal, TextInput } from 'react-native';

const KEY_METRICS = [
	{
		id: 'stability',
		label: 'Stability window',
		value: '92%',
		caption: 'Samples in tolerance',
		badge: '+4% weekly',
		badgeClass: 'text-emerald-300',
		borderClass: 'border-emerald-500/40',
	},
	{
		id: 'response',
		label: 'Response time',
		value: '14m',
		caption: 'Median response SLA',
		badge: 'Network OK',
		badgeClass: 'text-sky-300',
		borderClass: 'border-sky-500/40',
	},
	{
		id: 'imaging',
		label: 'Imaging queue',
		value: '08',
		caption: 'Slides awaiting review',
		badge: '2 flagged',
		badgeClass: 'text-amber-300',
		borderClass: 'border-amber-400/40',
	},
	{
		id: 'deployments',
		label: 'Deployments',
		value: '27',
		caption: 'Active stations',
		badge: '3 offline',
		badgeClass: 'text-rose-300',
		borderClass: 'border-rose-400/40',
	},
];

const CHEMISTRY_CARDS = [
	{
		id: 'ph',
		label: 'pH',
		value: '7.2',
		descriptor: 'Neutral window',
		change: '+0.1 vs 24h',
		barWidth: 'w-[72%]',
		barColor: 'bg-emerald-400',
	},
	{
		id: 'turbidity',
		label: 'Turbidity',
		value: '1.4 NTU',
		descriptor: 'Clear sample',
		change: '-0.3 vs week',
		barWidth: 'w-[30%]',
		barColor: 'bg-sky-400',
	},
	{
		id: 'temperature',
		label: 'Temperature',
		value: '18.4 deg C',
		descriptor: 'Within band',
		change: '+0.4 vs 6h',
		barWidth: 'w-[55%]',
		barColor: 'bg-amber-300',
	},
	{
		id: 'conductivity',
		label: 'Conductivity',
		value: '410 uS/cm',
		descriptor: 'Mineral load normal',
		change: 'Stable past day',
		barWidth: 'w-[65%]',
		barColor: 'bg-purple-300',
	},
];

const TASKS = [
	{
		id: 'calibration',
		title: 'Calibrate delta probes',
		detail: 'Last run 36h ago - assign to lab 02',
		state: 'Due soon',
		stateClass: 'text-amber-300',
	},
	{
		id: 'imaging',
		title: 'Review image anomalies',
		detail: 'Irrigation canal batch has 2 new flags',
		state: 'Focus',
		stateClass: 'text-rose-300',
	},
	{
		id: 'policy',
		title: 'Update compliance brief',
		detail: 'Align daily log format with WHO draft',
		state: 'In progress',
		stateClass: 'text-sky-300',
	},
];

const CHAT_TABS = [
	{ id: 'quality', label: 'Ask about water quality' },
	{ id: 'data', label: 'Ask about my data' },
];

const HomeScreen = ({ onNavigate }) => {
  const heroAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef(new Animated.Value(0)).current;
	const [chatOpen, setChatOpen] = useState(false);
	const [activeChatTab, setActiveChatTab] = useState('quality');
	const [chatInput, setChatInput] = useState('');
	const [chatThreads, setChatThreads] = useState({
		quality: [
			{
				id: 'quality-1',
				role: 'assistant',
				text: 'Ask me about stability windows, alerts, or sampling cadence.',
			},
		],
		data: [
			{
				id: 'data-1',
				role: 'assistant',
				text: 'I can interpret your uploads, OCR captures, and anomaly flags.',
			},
		],
	});

	const handleSendChat = () => {
		const trimmed = chatInput.trim();
		if (!trimmed) {
			return;
		}
		const threadKey = activeChatTab === 'quality' ? 'quality' : 'data';
		const replyText =
			threadKey === 'quality'
				? 'Working through recent water quality baselines and health indices for you.'
				: 'Reviewing your sample submissions, OCR fields, and anomaly flags now.';
		const timestamp = Date.now();
		setChatThreads((prev) => {
			const thread = prev[threadKey] || [];
			return {
				...prev,
				[threadKey]: [
					...thread,
					{ id: `${threadKey}-user-${timestamp}`, role: 'user', text: trimmed },
					{
						id: `${threadKey}-assistant-${timestamp + 1}`,
						role: 'assistant',
						text: replyText,
					},
				],
			};
		});
		setChatInput('');
	};

	const metricRows = useMemo(() => {
		const rows = [];
		for (let i = 0; i < KEY_METRICS.length; i += 2) {
			rows.push(KEY_METRICS.slice(i, i + 2));
		}
		return rows;
	}, []);

	const chemistryRows = useMemo(() => {
		const rows = [];
		for (let i = 0; i < CHEMISTRY_CARDS.length; i += 2) {
			rows.push(CHEMISTRY_CARDS.slice(i, i + 2));
		}
		return rows;
	}, []);

	useEffect(() => {
		Animated.parallel([
			Animated.timing(heroAnim, {
				toValue: 1,
				duration: 500,
				delay: 80,
				useNativeDriver: true,
			}),
			Animated.timing(cardsAnim, {
				toValue: 1,
				duration: 500,
				delay: 220,
				useNativeDriver: true,
			}),
		]).start();
	}, [heroAnim, cardsAnim]);

	const currentThread = chatThreads[activeChatTab === 'quality' ? 'quality' : 'data'] || [];

	return (
		<View className="flex-1 bg-aquadark">
			<ScrollView
				className="px-5 pt-10"
				contentContainerClassName="pb-20 gap-6"
				showsVerticalScrollIndicator={false}
			>
				<Animated.View
					style={{
						opacity: heroAnim,
						transform: [
							{
								translateY: heroAnim.interpolate({
									inputRange: [0, 1],
									outputRange: [24, 0],
								}),
							},
						],
					}}
					className="rounded-[34px] border border-sky-900/70 bg-gradient-to-br from-slate-950/90 via-sky-950/40 to-emerald-900/20 px-5 pb-6 pt-7"
				>
					<View className="flex-row items-start justify-between">
						<View className="max-w-[70%]">
							<Text className="text-[11px] uppercase tracking-[3px] text-sky-400">
								Lake Biwa cluster
							</Text>
							<Text className="mt-2 text-[22px] font-semibold text-sky-50">
								Operations pulse
							</Text>
							<Text className="mt-1 text-[12px] text-slate-400">
								Updated 09:41 UTC
							</Text>
						</View>
						<View className="items-end">
							<View className="rounded-full border border-slate-800/70 bg-slate-950/70 px-4 py-1">
								<Text className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
									Ops Live
								</Text>
							</View>
						</View>
					</View>

					<View className="mt-5 items-center">
						<View className="h-20 w-20 items-center justify-center rounded-[26px] border border-sky-800/70 bg-slate-950/70">
							<Text className="text-[22px] font-semibold text-sky-50">AC</Text>
						</View>
						<Text className="mt-3 text-[17px] font-semibold text-sky-50">
							Dr. Aria Collins
						</Text>
						<Text className="text-[12px] text-slate-400">Field intelligence lead</Text>
					</View>

					<View className="mt-5 rounded-2xl border border-sky-900/60 bg-slate-950/60 px-4 py-3">
						<Text className="text-[12px] uppercase tracking-wide text-sky-300">
							Cluster health
						</Text>
						<View className="mt-2 flex-row items-center justify-between">
							<View>
								<Text className="text-[28px] font-semibold text-emerald-200">
									Low risk
								</Text>
								<Text className="text-[13px] text-slate-400">Composite index 0.18</Text>
							</View>
							<TouchableOpacity
								activeOpacity={0.85}
								className="rounded-full border border-aquaaccent/60 bg-aquaaccent/10 px-4 py-2"
							>
								<Text className="text-[12px] font-semibold text-aquaaccent">
									Sync sensors
								</Text>
							</TouchableOpacity>
						</View>
						<View className="mt-3 h-1.5 w-full rounded-full bg-slate-900">
							<View className="h-full w-[32%] rounded-full bg-emerald-400" />
						</View>
						<Text className="mt-2 text-[11px] text-slate-400">
							Based on turbidity, conductivity, imaging anomalies, and pathogen scan delta.
						</Text>
					</View>

					<Animated.View
						style={{
							opacity: heroAnim,
							transform: [
								{
									translateY: heroAnim.interpolate({
										inputRange: [0, 1],
										outputRange: [12, 0],
									}),
								},
							],
						}}
						className="mt-4 rounded-[28px] border border-aquaaccent/40 bg-slate-950/80 p-4"
					>
						<View className="flex-row items-center justify-between">
							<View className="max-w-[70%]">
								<Text className="text-[12px] uppercase tracking-wide text-sky-300">
									WaterOps Copilot
								</Text>
								<Text className="mt-1 text-[13px] text-slate-300">
									Tap to brief our assistant on quality signals or your latest uploads.
								</Text>
							</View>
							<View className="rounded-full border border-slate-800/70 px-3 py-1">
								<Text className="text-[11px] font-semibold text-slate-300">Beta</Text>
							</View>
						</View>
						<TouchableOpacity
							activeOpacity={0.85}
							className="mt-4 rounded-2xl border border-slate-800/80 bg-slate-900/80 px-4 py-3"
							onPress={() => {
								setChatOpen(true);
							}}
						>
							<Text className="text-[12px] text-slate-400">
								Ask about stability windows, anomaly triage, or summarized data pulses...
							</Text>
							<View className="mt-3 flex-row flex-wrap gap-2">
								{CHAT_TABS.map((tab) => (
									<View
										key={tab.id}
										className="rounded-full border border-slate-800/70 px-3 py-1"
									>
										<Text className="text-[11px] text-slate-300">{tab.label}</Text>
									</View>
								))}
							</View>
						</TouchableOpacity>
					</Animated.View>
				</Animated.View>

				<Animated.View
					style={{
						opacity: cardsAnim,
						transform: [
							{
								translateY: cardsAnim.interpolate({
									inputRange: [0, 1],
									outputRange: [18, 0],
								}),
							},
						],
					}}
					className="gap-4"
				>
					{metricRows.map((row) => (
						<View key={row[0].id} className="flex-row gap-3">
							{row.map((metric) => (
								<View
									key={metric.id}
									className={`flex-1 rounded-3xl border ${metric.borderClass} bg-slate-950/60 p-4`}
								>
									<Text className="text-[12px] uppercase tracking-wide text-slate-400">
										{metric.label}
									</Text>
									<View className="mt-3 flex-row items-end justify-between">
										<Text className="text-[26px] font-semibold text-sky-50">
											{metric.value}
										</Text>
										<Text className="text-[11px] text-slate-400">
											{metric.caption}
										</Text>
									</View>
									<Text className={`mt-3 text-[12px] font-semibold ${metric.badgeClass}`}>
										{metric.badge}
									</Text>
								</View>
							))}
						</View>
					))}
				</Animated.View>

				<View className="gap-3">
					{chemistryRows.map((row, rowIndex) => (
						<View key={`${row[0].id}-${rowIndex}`} className="flex-row gap-3">
							{row.map((card) => (
								<View
									key={card.id}
									className="flex-1 rounded-3xl border border-sky-900/70 bg-slate-950/70 p-4"
								>
									<Text className="text-[12px] uppercase tracking-wide text-sky-300">
										{card.label}
									</Text>
									<Text className="mt-2 text-[20px] font-semibold text-sky-50">
										{card.value}
									</Text>
									<Text className="text-[12px] text-slate-400">{card.descriptor}</Text>
									<Text className="mt-1 text-[11px] text-slate-500">{card.change}</Text>
									<View className="mt-3 h-1.5 w-full rounded-full bg-slate-900">
										<View className={`h-full rounded-full ${card.barWidth} ${card.barColor}`} />
									</View>
								</View>
							))}
						</View>
					))}
				</View>

				<View className="rounded-3xl border border-emerald-600/40 bg-emerald-900/10 p-5">
					<Text className="text-[12px] uppercase tracking-wide text-emerald-300">
						Image insights
					</Text>
					<Text className="mt-2 text-[14px] text-slate-200">
						No anomalies detected in last microscopy run. Dusk captures share 96 percent match with healthy baseline.
					</Text>
					<Text className="mt-2 text-[11px] text-slate-400">
						Next auto-ingest window starts 12:30 UTC. Confirm glare mask before batch uploads.
					</Text>
				</View>

				<View className="rounded-3xl border border-sky-900/70 bg-slate-950/80 p-5">
					<View className="flex-row items-center justify-between">
						<Text className="text-[13px] uppercase tracking-wide text-sky-300">
							Action queue
						</Text>
						<Text className="text-[12px] text-slate-400">Updated 5m ago</Text>
					</View>
					{TASKS.map((task) => (
						<View
							key={task.id}
							className="mt-4 rounded-2xl border border-slate-800/80 bg-slate-950/80 px-4 py-3"
						>
							<View className="flex-row items-center justify-between">
								<Text className="text-[15px] font-semibold text-sky-50">
									{task.title}
								</Text>
								<Text className={`text-[12px] font-semibold ${task.stateClass}`}>
									{task.state}
								</Text>
							</View>
							<Text className="mt-1 text-[12px] text-slate-400">{task.detail}</Text>
						</View>
					))}
				</View>

			</ScrollView>

			<Modal
				visible={chatOpen}
				animationType="fade"
				transparent
				onRequestClose={() => setChatOpen(false)}
			>
				<View className="flex-1 bg-black/70 px-5 py-10">
					<View className="flex-1 justify-center">
						<View className="max-h-[80%] rounded-[32px] border border-sky-900/80 bg-slate-950/95 p-5">
							<View className="flex-row items-center justify-between">
								<View>
									<Text className="text-[16px] font-semibold text-sky-50">
										WaterOps Copilot
									</Text>
									<Text className="text-[12px] text-slate-400">
										Conversational assistant
									</Text>
								</View>
								<TouchableOpacity
									activeOpacity={0.8}
									onPress={() => setChatOpen(false)}
									className="h-10 w-10 items-center justify-center rounded-full border border-slate-800/70"
								>
									<Text className="text-[16px] font-semibold text-sky-100">X</Text>
								</TouchableOpacity>
							</View>

							<View className="mt-4 flex-row rounded-full border border-slate-800/80 bg-slate-900/60 p-1">
								{CHAT_TABS.map((tab) => {
									const selected = activeChatTab === tab.id;
									return (
										<TouchableOpacity
											key={tab.id}
											activeOpacity={0.85}
											className={`flex-1 rounded-full px-3 py-1.5 ${
												selected ? 'bg-aquaaccent/20' : 'bg-transparent'
											}`}
											onPress={() => setActiveChatTab(tab.id)}
										>
											<Text
												className={`text-center text-[12px] font-semibold ${
													selected ? 'text-aquaaccent' : 'text-slate-300'
												}`}
											>
												{tab.label}
											</Text>
										</TouchableOpacity>
									);
								})}
							</View>

							<ScrollView
								className="mt-5"
								contentContainerClassName="gap-3 pb-4"
								showsVerticalScrollIndicator={false}
								style={{ maxHeight: 320 }}
							>
								{currentThread.map((message) => {
									const isUser = message.role === 'user';
									return (
										<View
											key={message.id}
											className={`max-w-[85%] rounded-2xl px-4 py-3 ${
												isUser
													? 'self-end bg-aquaaccent/20 border border-aquaaccent/40'
												: 'self-start border border-slate-800/80 bg-slate-900/80'
											}`}
										>
											<Text className="text-[13px] text-sky-50">{message.text}</Text>
										</View>
									);
								})}
							</ScrollView>

							<View className="mt-4 flex-row items-center gap-3">
								<TextInput
									className="flex-1 rounded-2xl border border-slate-800/70 bg-slate-900/80 px-4 py-3 text-sky-100"
									placeholder="Write a prompt..."
									placeholderTextColor="#94a3b8"
									value={chatInput}
									onChangeText={setChatInput}
									multiline
									style={{ maxHeight: 100 }}
								/>
								<TouchableOpacity
									activeOpacity={0.85}
									className="rounded-2xl border border-aquaaccent/60 bg-aquaaccent/80 px-4 py-3"
									onPress={handleSendChat}
								>
									<Text className="text-[13px] font-semibold text-slate-950">Send</Text>
								</TouchableOpacity>
							</View>
						</View>
					</View>
				</View>
			</Modal>

		</View>
	);
};

export default HomeScreen;
