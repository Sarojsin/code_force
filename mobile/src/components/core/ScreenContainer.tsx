/**
 * ScreenContainer — core layout component.
 * Rule §2.4: central layout primitive; handles safe area + bottom tab bar padding.
 * Rule §2.7: FlatList gets performance props automatically; ScrollView does not get keyboardDismissMode.
 */

import React, { ReactNode } from 'react';
import { FlatList, ScrollView, View, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

interface ScreenContainerProps {
  children: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  keyboardDismissMode?: 'none' | 'interactive' | 'on-drag';
  showsVerticalScrollIndicator?: boolean;
  scrollEnabled?: boolean;
  onScroll?: ScrollView['props']['onScroll'];
  data?: any[];
  renderItem?: (info: { item: any; index: number }) => React.ReactElement | null;
  keyExtractor?: (item: any, index: number) => string;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  ListHeaderComponent?: React.ReactElement | null;
  ListFooterComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function ScreenContainer(props: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const bottomPadding = insets.bottom + tabBarHeight;

  const baseContentStyle = {
    paddingBottom: bottomPadding,
    paddingTop: insets.top,
  };

  const baseStyle: ViewStyle = {
    flex: 1,
    backgroundColor: 'transparent',
  };

  if (props.scroll) {
    // ScrollView mode — NO keyboardDismissMode (only valid on FlatList)
    return (
      <ScrollView
        style={[baseStyle, props.style]}
        contentContainerStyle={[baseContentStyle, props.contentContainerStyle]}
        showsVerticalScrollIndicator={props.showsVerticalScrollIndicator ?? false}
        scrollEnabled={props.scrollEnabled ?? true}
        onScroll={props.onScroll}
        keyboardShouldPersistTaps="handled"
      >
        {props.children}
      </ScrollView>
    );
  }

  if (props.data !== undefined) {
    // FlatList mode — keyboardDismissMode IS valid here
    return (
      <FlatList
        data={props.data}
        renderItem={props.renderItem!}
        keyExtractor={props.keyExtractor!}
        onEndReached={props.onEndReached}
        onEndReachedThreshold={props.onEndReachedThreshold}
        ListHeaderComponent={props.ListHeaderComponent}
        ListFooterComponent={props.ListFooterComponent}
        ListEmptyComponent={props.ListEmptyComponent}
        contentContainerStyle={[baseContentStyle, props.contentContainerStyle]}
        style={[baseStyle, props.style]}
        showsVerticalScrollIndicator={props.showsVerticalScrollIndicator ?? false}
        scrollEnabled={props.scrollEnabled ?? true}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={props.keyboardDismissMode ?? 'none'}
        refreshing={props.refreshing}
        onRefresh={props.onRefresh}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        initialNumToRender={7}
        windowSize={5}
        getItemLayout={undefined}
      />
    );
  }

  // Default View mode
  return (
    <View style={[baseStyle, { paddingBottom: bottomPadding, paddingTop: insets.top }, props.style]}>
      {props.children}
    </View>
  );
}
