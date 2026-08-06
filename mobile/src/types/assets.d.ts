declare module '*.png' {
  const value: number;
  export default value;
}

declare module '*.jpg' {
  const value: number;
  export default value;
}

declare module '*.jpeg' {
  const value: number;
  export default value;
}

declare module '*.gif' {
  const value: number;
  export default value;
}

declare module '*.svg' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

declare module '*.glb' {
  const value: number;
  export default value;
}

declare module 'react-native-skeleton-placeholder' {
  import * as React from 'react';
  import { ViewStyle, StyleProp } from 'react-native';

  interface SkeletonPlaceholderProps {
    backgroundColor?: string;
    highlightColor?: string;
    speed?: number;
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
  }

  interface SkeletonPlaceholderComponent extends React.ComponentClass<SkeletonPlaceholderProps> {
    Item: React.ComponentClass<SkeletonPlaceholderProps>;
  }

  const SkeletonPlaceholder: SkeletonPlaceholderComponent;
  export default SkeletonPlaceholder;
}
