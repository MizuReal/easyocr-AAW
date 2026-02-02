import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList, Animated } from 'react-native';

const TAG_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'field', label: 'Field Ops' },
  { id: 'lab', label: 'Lab Insights' },
  { id: 'policy', label: 'Policy' },
  { id: 'hardware', label: 'Hardware' },
  { id: 'ai', label: 'AI Models' },
];

const SAMPLE_POSTS = [
  {
    id: '1',
    author: 'Dr. Maya Jensen',
    initials: 'MJ',
    role: 'Hydrologist - Kyoto',
    time: '12m',
    title: 'Sensor drift in cold chain deployments',
    excerpt:
      'Seeing a subtle upward drift on conductivity probes after 72h in transit. Anyone stress-tested the new self-calibration routine in humid conditions?',
    tags: ['Field Ops', 'Diagnostics'],
    metrics: { likes: 24, replies: 6 },
  },
  {
    id: '2',
    author: 'Liam Ortiz',
    initials: 'LO',
    role: 'ML Engineer - Bogota',
    time: '1h',
    title: 'Deploying the algae classifier v0.9',
    excerpt:
      'Rolled the beta weights to three irrigation districts. Precision jumped but recall dipped on dusk captures—sharing confusion matrices in the thread.',
    tags: ['AI Models', 'Rollout'],
    metrics: { likes: 41, replies: 12 },
  },
  {
    id: '3',
    author: 'Prof. S. Patel',
    initials: 'SP',
    role: 'Policy Advisor - Nairobi',
    time: '3h',
    title: 'Drafting compliance briefs for new WHO thresholds',
    excerpt:
      'Working doc outlines how community labs can document compliance without overburdening technicians. Feedback welcome before Friday.',
    tags: ['Policy', 'Guidelines'],
    metrics: { likes: 19, replies: 9 },
  },
];

const HIGHLIGHTS = [
  'Realtime nitrate baselines shared by 48 labs this week.',
  'Two new open datasets for turbidity benchmarks uploaded today.',
  'Live Q&A with the infra team on Friday 14:00 UTC.',
];

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const CommunityForumScreen = ({ onNavigate }) => {
  const heroAnim = useRef(new Animated.Value(0)).current;
  const screenAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(heroAnim, {
      toValue: 1,
      duration: 500,
      delay: 100,
      useNativeDriver: true,
    }).start();
  }, [heroAnim]);

  useEffect(() => {
    Animated.timing(screenAnim, {
      toValue: 1,
      duration: 450,
      delay: 40,
      useNativeDriver: true,
    }).start();
  }, [screenAnim]);

  const header = useMemo(
    () => (
      <View className="gap-5">
        <View className="px-5 pt-12 flex-row items-center justify-between">
          <TouchableOpacity
            className="h-10 w-10 items-center justify-center rounded-2xl border border-sky-900/70 bg-slate-950/70"
            activeOpacity={0.85}
            onPress={() => onNavigate?.('home')}
          >
            <Text className="text-xl text-sky-100">{'<'}</Text>
          </TouchableOpacity>
          <View className="items-center">
            <Text className="text-[12px] uppercase tracking-[3px] text-sky-500">
              Community
            </Text>
            <Text className="text-[20px] font-semibold text-sky-50">Forum Feed</Text>
          </View>
          <View className="rounded-2xl border border-emerald-600/60 bg-emerald-900/30 px-3 py-2">
            <Text className="text-[11px] font-semibold uppercase text-emerald-200">
              +18 new
            </Text>
          </View>
        </View>

        <Animated.View
          style={{
            opacity: heroAnim,
            transform: [
              {
                translateY: heroAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
            ],
          }}
          className="mx-5 rounded-[30px] border border-sky-900/60 bg-gradient-to-br from-slate-950/90 via-sky-950/40 to-emerald-950/30 p-5"
        >
          <Text className="text-[12px] uppercase tracking-wide text-sky-400">
            Collective insights
          </Text>
          <Text className="mt-2 text-[20px] font-semibold text-sky-50">
            Share field signals, lab wins, and policy drafts in one flow.
          </Text>
          <View className="mt-4 gap-3">
            {HIGHLIGHTS.map((item) => (
              <View key={item} className="flex-row items-start gap-2">
                <Text className="text-lg text-emerald-300">-</Text>
                <Text className="flex-1 text-[13px] text-slate-300">{item}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="pl-5"
          contentContainerClassName="pr-5 gap-3"
        >
          {TAG_FILTERS.map((tag, index) => (
            <TouchableOpacity
              key={tag.id}
              activeOpacity={0.85}
              className={`rounded-2xl border px-4 py-2 ${
                index === 0
                  ? 'border-aquaaccent bg-aquaaccent/20'
                  : 'border-sky-900/70 bg-slate-950/60'
              }`}
            >
              <Text
                className={`text-[13px] ${
                  index === 0 ? 'text-aquaaccent' : 'text-slate-200'
                }`}
              >
                {tag.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    ),
    [heroAnim, onNavigate]
  );

  return (
    <Animated.View
      className="flex-1 bg-aquadark"
      style={{
        opacity: screenAnim,
        transform: [
          {
            translateY: screenAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [16, 0],
            }),
          },
        ],
      }}
    >
      <AnimatedFlatList
        data={SAMPLE_POSTS}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <PostCard post={item} index={index} />}
        ListHeaderComponent={header}
        contentContainerClassName="pb-32 gap-4"
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        activeOpacity={0.85}
        className="absolute bottom-8 right-6 flex-row items-center rounded-full border border-aquaaccent/40 bg-aquaaccent/80 px-5 py-3 shadow-lg shadow-sky-900/80"
      >
        <Text className="mr-2 text-xl text-slate-950">+</Text>
        <Text className="text-[14px] font-semibold text-slate-950">Start a thread</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const PostCard = ({ post, index }) => {
  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 350,
      delay: 200 + index * 120,
      useNativeDriver: true,
    }).start();
    Animated.timing(translate, {
      toValue: 0,
      duration: 350,
      delay: 200 + index * 120,
      useNativeDriver: true,
    }).start();
  }, [fade, translate, index]);

  return (
    <Animated.View
      style={{
        opacity: fade,
        transform: [{ translateY: translate }],
      }}
      className="mx-5 rounded-[28px] border border-sky-900/70 bg-slate-950/60 p-5"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-2xl border border-sky-800/70 bg-slate-950/70">
            <Text className="text-[15px] font-semibold text-sky-100">{post.initials}</Text>
          </View>
          <View>
            <Text className="text-[15px] font-semibold text-sky-50">{post.author}</Text>
            <Text className="text-[11px] text-slate-400">{post.role}</Text>
          </View>
        </View>
        <Text className="text-[11px] text-slate-500">{post.time}</Text>
      </View>

      <Text className="mt-4 text-[16px] font-semibold text-sky-50">{post.title}</Text>
      <Text className="mt-2 text-[13px] leading-5 text-slate-300">{post.excerpt}</Text>

      <View className="mt-4 flex-row flex-wrap gap-2">
        {post.tags.map((tag) => (
          <View
            key={tag}
            className="rounded-full border border-sky-800/50 bg-sky-900/30 px-3 py-1"
          >
            <Text className="text-[11px] text-sky-200">#{tag}</Text>
          </View>
        ))}
      </View>

      <View className="mt-5 flex-row items-center justify-between border-t border-sky-900/60 pt-4">
        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center gap-1">
            <Text className="text-[12px] font-semibold text-rose-300">Like</Text>
            <Text className="text-[12px] text-slate-300">{post.metrics.likes}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="text-[12px] font-semibold text-sky-300">Reply</Text>
            <Text className="text-[12px] text-slate-300">{post.metrics.replies}</Text>
          </View>
        </View>
        <TouchableOpacity activeOpacity={0.85}>
          <Text className="text-[12px] font-semibold text-aquaaccent">Open thread {'->'}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

export default CommunityForumScreen;
