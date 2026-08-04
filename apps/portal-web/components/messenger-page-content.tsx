"use client";

import { IconMessage } from "@tabler/icons-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";

/** Заглушка мессенджера завод ↔ дилер до полноценного чата */
export function MessengerPageContent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Мессенджер</CardTitle>
      </CardHeader>
      <CardContent>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconMessage />
            </EmptyMedia>
            <EmptyTitle>Мессенджер скоро</EmptyTitle>
            <EmptyDescription>
              Переписка между заводом и дилерами появится здесь. Пока раздел в разработке.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  );
}
